import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TasksService } from "../tasks/tasks.service";
import { decryptSecret, encryptSecret } from "../../common/crypto";

// TODO: replyToConversation usaba ChatwootService para leer y enviar mensajes.
// Cuando el InboxService propio esté listo, reconectar aquí.

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
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

  /**
   * Responde automáticamente a una conversación entrante de WhatsApp
   * usando el agente activo de la organización y su knowledge base.
   *
   * TODO: pendiente de reconectar cuando el InboxService propio esté listo.
   * Por ahora recibe el historial de mensajes directamente como parámetro.
   */
  async replyToConversation(
    organizationId: string,
    messageHistory: { role: "user" | "assistant"; content: string }[],
    contactId?: string,
  ): Promise<{ reply: string } | { skipped: true; reason?: string } | { handoff: true }> {
    const agent = await this.prisma.aiAgent.findFirst({
      where: { organizationId, active: true },
      include: { knowledge: true },
    });
    if (!agent) return { skipped: true };

    const lastText = messageHistory.at(-1)?.content?.toLowerCase() ?? "";
    const HANDOFF_HINTS = ["humano", "asesor", "agente", "persona", "hablar con alguien", "human", "agent"];

    if (HANDOFF_HINTS.some((h) => lastText.includes(h))) {
      return this.handoff(organizationId, contactId);
    }

    const kb = agent.knowledge.map((k) => `## ${k.title}\n${k.content}`).join("\n");
    const reply = await this.complete({
      apiKey: agent.encryptedApiKey ? decryptSecret(agent.encryptedApiKey) : process.env.OPENAI_API_KEY,
      model: agent.model,
      temperature: agent.temperature,
      systemPrompt: `${agent.systemPrompt}\n\nObjetivo: ${agent.goal || ""}\n\nKnowledge:\n${kb}`,
      history: messageHistory,
    });

    if (!reply) return { skipped: true, reason: "no_llm" };

    if (reply.toLowerCase().includes("[handoff]")) {
      return this.handoff(organizationId, contactId);
    }

    return { reply };
  }

  private async handoff(organizationId: string, contactId?: string) {
    if (contactId) {
      await this.tasks.create(organizationId, {
        title: "IA transfirió la conversación",
        contactId,
        priority: "high",
      });
    }
    return { handoff: true as const };
  }

  private async complete(input: {
    apiKey?: string;
    model: string;
    temperature: number;
    systemPrompt: string;
    history: { role: "user" | "assistant"; content: string }[];
  }) {
    if (!input.apiKey) return null;
    const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    try {
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
            { role: "system", content: input.systemPrompt },
            ...input.history,
          ],
        }),
      });
      if (!res.ok) {
        this.logger.error(`OpenAI error: ${res.status}`);
        return null;
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return json.choices?.[0]?.message?.content || null;
    } catch (err) {
      this.logger.error("Error calling LLM", err);
      return null;
    }
  }
}
