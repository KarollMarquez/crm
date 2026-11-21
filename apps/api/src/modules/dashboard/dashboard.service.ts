import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(organizationId: string) {
    const [leads, deals, tasks, conversations, campaigns] = await Promise.all([
      this.prisma.lead.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: true,
      }),
      this.prisma.deal.findMany({
        where: { organizationId },
        include: { stage: true },
      }),
      this.prisma.task.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: true,
      }),
      this.prisma.chatwootConversationLink.aggregate({
        where: { organizationId },
        _count: true,
        _max: { lastMessageAt: true },
      }),
      this.prisma.campaign.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);

    const totalValue = deals.reduce((sum: number, d) => sum + Number(d.value), 0);
    const won = deals.filter((d) => d.stage.isWon);
    const lost = deals.filter((d) => d.stage.isLost);
    const wonValue = won.reduce((sum: number, d) => sum + Number(d.value), 0);
    const lostValue = lost.reduce((sum: number, d) => sum + Number(d.value), 0);

    return {
      leads: Object.fromEntries(leads.map((l) => [l.status, l._count])),
      pipeline: {
        totalValue,
        wonValue,
        lostValue,
        conversion:
          deals.length === 0 ? 0 : Math.round((won.length / deals.length) * 100),
        open: deals.length - won.length - lost.length,
      },
      tasks: Object.fromEntries(tasks.map((t) => [t.status, t._count])),
      whatsapp: {
        conversations: conversations._count,
        lastActivity: conversations._max.lastMessageAt,
      },
      campaigns: campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        sent: c.sentCount,
        delivered: c.deliveredCount,
        replies: c.repliedCount,
      })),
    };
  }
}
