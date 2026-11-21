import { Injectable, NotFoundException } from "@nestjs/common";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { parsePublicNumber } from "../../common/public-number";
import { PrismaService } from "../../prisma/prisma.service";
import { RealtimeGateway } from "../../realtime/realtime.gateway";
import { OutboundService } from "../integrations/outbound.service";

const taskInclude = {
  contact: true,
  deal: true,
  assignee: { select: { id: true, name: true } },
} as const;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly outbound: OutboundService,
  ) {}

  list(organizationId: string, status?: TaskStatus) {
    return this.prisma.task.findMany({
      where: { organizationId, ...(status ? { status } : {}) },
      include: taskInclude,
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    });
  }

  async get(organizationId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, organizationId },
      include: taskInclude,
    });
    if (!task) throw new NotFoundException("Task not found");
    return task;
  }

  private async resolveContactId(organizationId: string, contactId?: string | null) {
    if (!contactId) return null;
    const publicNumber = parsePublicNumber(contactId);
    const contact = await this.prisma.contact.findFirst({
      where: {
        organizationId,
        ...(publicNumber != null ? { OR: [{ id: contactId }, { publicNumber }] } : { id: contactId }),
      },
      select: { id: true, name: true },
    });
    if (!contact) throw new NotFoundException("Contact not found");
    return contact;
  }

  async create(
    organizationId: string,
    input: {
      title: string;
      contactId?: string | null;
      dealId?: string | null;
      assigneeId?: string | null;
      dueAt?: string | null;
      priority?: TaskPriority;
      status?: TaskStatus;
    },
  ) {
    const contact = await this.resolveContactId(organizationId, input.contactId);
    const task = await this.prisma.task.create({
      data: {
        organizationId,
        title: input.title,
        contactId: contact?.id ?? null,
        dealId: input.dealId || null,
        assigneeId: input.assigneeId || null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        priority: input.priority || "medium",
        status: input.status || "pending",
      },
      include: taskInclude,
    });

    await this.notifyTaskCreated(organizationId, task);
    await this.outbound.emit(organizationId, "task.created", task);
    return task;
  }

  private async notifyTaskCreated(
    organizationId: string,
    task: {
      id: string;
      title: string;
      priority: string;
      assigneeId?: string | null;
      contact?: { name: string } | null;
    },
  ) {
    const title = "Nueva tarea";
    const body = task.contact?.name
      ? `${task.title} · ${task.contact.name}`
      : task.title;

    const members = await this.prisma.organizationUser.findMany({
      where: { organizationId },
      select: { userId: true },
    });
    const targetUserIds = task.assigneeId
      ? [task.assigneeId]
      : members.map((m) => m.userId);

    if (targetUserIds.length) {
      await this.prisma.notification.createMany({
        data: targetUserIds.map((userId) => ({
          organizationId,
          userId,
          title,
          body,
        })),
      });
    } else {
      await this.prisma.notification.create({
        data: { organizationId, title, body },
      });
    }

    this.realtime.emitToOrg(organizationId, "notification", {
      type: "task.created",
      title,
      body,
      taskId: task.id,
      priority: task.priority,
      sound: true,
      createdAt: new Date().toISOString(),
    });
  }

  update(
    organizationId: string,
    id: string,
    data: Partial<{
      title: string;
      status: TaskStatus;
      priority: TaskPriority;
      dueAt: string | null;
      assigneeId: string | null;
    }>,
  ) {
    return this.prisma.task.update({
      where: { id },
      data: {
        title: data.title,
        status: data.status,
        priority: data.priority,
        assigneeId: data.assigneeId,
        dueAt: data.dueAt ? new Date(data.dueAt) : data.dueAt === null ? null : undefined,
      },
      include: taskInclude,
    });
  }
}
