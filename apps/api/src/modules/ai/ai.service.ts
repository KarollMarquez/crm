import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ChatwootService } from "../chatwoot/chatwoot.service";
import { TasksService } from "../tasks/tasks.service";
import { decryptSecret, encryptSecret } from "../../common/crypto";

const HANDOFF_HINTS = [
  "humano",
  "asesor",
  "agente",
  "persona",
  "hablar con alguien",
  "human",
  "agent",
];

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatwoot: ChatwootService,
    private readonly tasks: TasksService,
  ) {}

  list(organizationId: string) {
    return this.prisma.aiAgent.findMany({
      where: { organizationId },
      include: { knowledge: true },
      orderBy: { createdAt: "desc" },
    });
  }

  create(
    organizationId: string,
    input: {
      name: string;
      description?: string;
      goal?: string;
      systemPrompt: string;
      model?: string;
      temperature?: number;
      active?: boolean;
      inboxIds?: string[];
      apiKey?: string;
    },
  ) {
    return this.prisma.aiAgent.create({
      data: {
        organizationId,
        name: input.name,
        description: input.description,
        goal: input.goal,
        systemPrompt: input.systemPrompt,
        model: input.model || "gpt-4o-mini",
        temperature: input.temperature ?? 0.4,
        active: input.active ?? false,
        inboxIds: input.inboxIds || [],
        encryptedApiKey: input.apiKey ? encryptSecret(input.apiKey) : undefined,
      },
    });
  }

  update(id: string, data: Record<string, unknown>) {
    const { apiKey, ...rest } = data;
    return this.prisma.aiAgent.update({
      where: { id },
      data: {
        ...(rest as object),
        ...(typeof apiKey === "string" ? { encryptedApiKey: encryptSecret(apiKey) } : {}),
      },
    });
  }

  addKnowledge(organizationId: string, agentId: string, title: string, content: string) {
    return this.prisma.aiKnowledge.create({
      data: { organizationId, agentId, title, content },
    });
  }

  async replyToConversation(organizationId: string, conversationId: number, chatwootContactId?: number) {
    const agent = await this.prisma.aiAgent.findFirst({
      where: { organizationId, active: true },
      include: { knowledge: true },
    });
    if (!agent) return { skipped: true };

    let contact = chatwootContactId
      ? await this.prisma.chatwootContactLink.findUnique({
          where: {
            organizationId_chatwootContactId: { organizationId, chatwootContactId },
          },
          include: {
            contact: {
              include: {
                leads: { take: 1, orderBy: { createdAt: "desc" } },
                deals: { include: { stage: true }, take: 1 },
              },
            },
          },
        })
      : null;

    const messages = await this.chatwoot.getMessages(organizationId, conversationId);
    const lastIncoming = [...messages].reverse().find((m) => m.message_type === 0 || m.message_type === "incoming");
    const lastText = String(lastIncoming?.content || "").toLowerCase();
    if (HANDOFF_HINTS.some((h) => lastText.includes(h))) {
      return this.handoff(organizationId, conversationId, contact?.contactId);
    }

    const history = messages
      .map((m) => `${m.sender?.name || "user"}: ${m.content || ""}`)
      .join("\n");
    const kb = agent.knowledge.map((k) => `## ${k.title}\n${k.content}`).join("\n");
    const crmContext = contact?.contact
      ? JSON.stringify({
          name: contact.contact.name,
          lead: contact.contact.leads[0],
          deal: contact.contact.deals[0],
        })
      : "";

    const reply = await this.complete({
      apiKey: agent.encryptedApiKey ? decryptSecret(agent.encryptedApiKey) : process.env.OPENAI_API_KEY,
      model: agent.model,
      temperature: agent.temperature,
      system: `${agent.systemPrompt}\n\nObjetivo: ${agent.goal || ""}\nKnowledge:\n${kb}\nCRM:\n${crmContext}`,
      user: history || lastText,
    });

    if (!reply) return { skipped: true, reason: "no_llm" };
    if (HANDOFF_HINTS.some((h) => reply.toLowerCase().includes("[handoff]"))) {
      return this.handoff(organizationId, conversationId, contact?.contactId);
    }
    await this.chatwoot.sendMessage(organizationId, conversationId, reply);
    return { reply };
  }

  private async handoff(organizationId: string, conversationId: number, contactId?: string) {
    await this.chatwoot.updateConversation(organizationId, conversationId, { status: "open" });
    if (contactId) {
      await this.tasks.create(organizationId, {
        title: "IA transfirió la conversación",
        contactId,
        priority: "high",
      });
    }
    await this.prisma.aiAgent.updateMany({
      where: { organizationId, active: true },
      data: { active: false },
    });
    return { handoff: true };
  }

  private async complete(input: {
    apiKey?: string;
    model: string;
    temperature: number;
    system: string;
    user: string;
  }) {
    if (!input.apiKey) return null;
    const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        temperature: input.temperature,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return json.choices?.[0]?.message?.content || null;
  }
}
