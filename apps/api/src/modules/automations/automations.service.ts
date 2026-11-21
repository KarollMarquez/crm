import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { QUEUE } from "../../queue/queue.module";
import { TagsService } from "../tags/tags.service";
import { TasksService } from "../tasks/tasks.service";
import { LeadsService } from "../leads/leads.service";
import { ChatwootService } from "../chatwoot/chatwoot.service";

@Injectable()
export class AutomationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tags: TagsService,
    private readonly tasks: TasksService,
    private readonly leads: LeadsService,
    private readonly chatwoot: ChatwootService,
    @InjectQueue(QUEUE.AUTOMATIONS) private readonly queue: Queue,
  ) {}

  list(organizationId: string) {
    return this.prisma.automation.findMany({
      where: { organizationId },
      include: { steps: { orderBy: { position: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
  }

  create(
    organizationId: string,
    input: {
      name: string;
      trigger: string;
      status?: "draft" | "active" | "paused";
      steps?: { type: string; config?: Record<string, unknown> }[];
    },
  ) {
    return this.prisma.automation.create({
      data: {
        organizationId,
        name: input.name,
        trigger: input.trigger,
        status: input.status || "draft",
        steps: {
          create: (input.steps || []).map((step, position) => ({
            position,
            type: step.type,
            config: (step.config || {}) as Prisma.InputJsonValue,
          })),
        },
      },
      include: { steps: true },
    });
  }

  updateStatus(organizationId: string, id: string, status: "draft" | "active" | "paused") {
    return this.prisma.automation.update({ where: { id }, data: { status } });
  }

  async handleTrigger(data: {
    organizationId: string;
    trigger: string;
    contactId?: string;
    conversationId?: number;
    leadId?: string;
  }) {
    const automations = await this.prisma.automation.findMany({
      where: { organizationId: data.organizationId, trigger: data.trigger, status: "active" },
      include: { steps: { orderBy: { position: "asc" } } },
    });
    for (const automation of automations) {
      const run = await this.prisma.automationRun.create({
        data: {
          organizationId: data.organizationId,
          automationId: automation.id,
          contactId: data.contactId,
          context: data as object,
        },
      });
      await this.runSteps(automation.steps, run.id, data, 0);
    }
  }

  async resume(runId: string, fromStep: number) {
    const run = await this.prisma.automationRun.findUnique({
      where: { id: runId },
      include: { automation: { include: { steps: { orderBy: { position: "asc" } } } } },
    });
    if (!run) return;
    await this.runSteps(
      run.automation.steps,
      run.id,
      (run.context || {}) as {
        organizationId: string;
        contactId?: string;
        conversationId?: number;
      },
      fromStep,
    );
  }

  private async runSteps(
    steps: { position: number; type: string; config: unknown }[],
    runId: string,
    ctx: { organizationId: string; contactId?: string; conversationId?: number },
    start: number,
  ) {
    for (const step of steps.filter((s) => s.position >= start)) {
      const config = (step.config || {}) as Record<string, unknown>;
      if (step.type === "wait") {
        const ms =
          Number(config.minutes || 0) * 60_000 ||
          Number(config.hours || 0) * 3_600_000 ||
          Number(config.days || 0) * 86_400_000 ||
          60_000;
        await this.prisma.automationRun.update({
          where: { id: runId },
          data: { currentStep: step.position + 1 },
        });
        await this.queue.add(
          "resume",
          { runId, fromStep: step.position + 1 },
          { delay: ms },
        );
        return;
      }
      if (step.type === "condition") {
        const tagId = config.tagId as string | undefined;
        if (tagId && ctx.contactId) {
          const has = await this.prisma.contactTag.findUnique({
            where: { contactId_tagId: { contactId: ctx.contactId, tagId } },
          });
          if (!has) break;
        }
        continue;
      }
      await this.applyAction(step.type, config, ctx);
    }
    await this.prisma.automationRun.update({
      where: { id: runId },
      data: { status: "completed" },
    });
  }

  private async applyAction(
    type: string,
    config: Record<string, unknown>,
    ctx: { organizationId: string; contactId?: string; conversationId?: number },
  ) {
    if (type === "add_tag" && ctx.contactId && config.tagId) {
      await this.prisma.contactTag.createMany({
        data: [{ contactId: ctx.contactId, tagId: String(config.tagId) }],
        skipDuplicates: true,
      });
    }
    if (type === "remove_tag" && ctx.contactId && config.tagId) {
      await this.prisma.contactTag.deleteMany({
        where: { contactId: ctx.contactId, tagId: String(config.tagId) },
      });
    }
    if (type === "create_task" && ctx.contactId) {
      await this.tasks.create(ctx.organizationId, {
        title: String(config.title || "Seguimiento"),
        contactId: ctx.contactId,
      });
    }
    if (type === "create_lead" && ctx.contactId) {
      await this.leads.create(ctx.organizationId, {
        contactId: ctx.contactId,
        source: "automation",
        service: config.service as string | undefined,
      });
    }
    if (type === "send_message" && ctx.conversationId && config.message) {
      await this.chatwoot.sendMessage(
        ctx.organizationId,
        ctx.conversationId,
        String(config.message),
      );
    }
    if (type === "handoff" && ctx.conversationId) {
      await this.chatwoot.updateConversation(ctx.organizationId, ctx.conversationId, {
        status: "open",
      });
      if (ctx.contactId) {
        await this.tasks.create(ctx.organizationId, {
          title: "Handoff: cliente solicita humano",
          contactId: ctx.contactId,
          priority: "high",
        });
      }
    }
  }
}
