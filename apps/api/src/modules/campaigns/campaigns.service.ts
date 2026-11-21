import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { QUEUE } from "../../queue/queue.module";
import { SegmentsService } from "../segments/segments.service";
import { ChatwootService } from "../chatwoot/chatwoot.service";
import { OutboundService } from "../integrations/outbound.service";

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly segments: SegmentsService,
    private readonly chatwoot: ChatwootService,
    private readonly outbound: OutboundService,
    @InjectQueue(QUEUE.CAMPAIGNS) private readonly queue: Queue,
  ) {}

  list(organizationId: string) {
    return this.prisma.campaign.findMany({
      where: { organizationId },
      include: { segment: true, inbox: true, _count: { select: { recipients: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  get(organizationId: string, id: string) {
    return this.prisma.campaign.findFirst({
      where: { id, organizationId },
      include: { recipients: { include: { contact: true } }, segment: true, inbox: true },
    });
  }

  create(
    organizationId: string,
    input: {
      name: string;
      segmentId?: string | null;
      inboxId?: string | null;
      templateName?: string;
      message: string;
    },
  ) {
    return this.prisma.campaign.create({
      data: {
        organizationId,
        name: input.name,
        segmentId: input.segmentId,
        inboxId: input.inboxId,
        templateName: input.templateName,
        message: input.message,
      },
    });
  }

  async launch(organizationId: string, id: string) {
    const campaign = await this.get(organizationId, id);
    if (!campaign) throw new NotFoundException("Campaign not found");
    const contacts = campaign.segmentId
      ? await this.segments.members(organizationId, campaign.segmentId)
      : await this.prisma.contact.findMany({ where: { organizationId } });
    await this.prisma.campaignRecipient.createMany({
      data: contacts.map((c) => ({ campaignId: id, contactId: c.id })),
      skipDuplicates: true,
    });
    await this.prisma.campaign.update({
      where: { id },
      data: { status: "running", startedAt: new Date() },
    });
    await this.queue.add("send", { organizationId, campaignId: id });
    return this.get(organizationId, id);
  }

  async processSend(organizationId: string, campaignId: string) {
    const campaign = await this.get(organizationId, campaignId);
    if (!campaign) return;
    const pending = campaign.recipients.filter((r) => r.status === "pending");
    let sent = 0;
    for (const recipient of pending) {
      try {
        const conv = recipient.contact
          ? await this.prisma.chatwootConversationLink.findFirst({
              where: { organizationId, contactId: recipient.contactId },
              orderBy: { lastMessageAt: "desc" },
            })
          : null;
        if (conv) {
          await this.chatwoot.sendMessage(
            organizationId,
            conv.chatwootConversationId,
            campaign.message,
          );
        }
        await this.prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: "sent", sentAt: new Date() },
        });
        sent += 1;
      } catch (err) {
        await this.prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: "failed", error: String(err) },
        });
      }
    }
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: "completed",
        completedAt: new Date(),
        sentCount: sent,
      },
    });
    await this.outbound.emit(organizationId, "campaign.completed", {
      campaignId,
      sent,
    });
  }
}
