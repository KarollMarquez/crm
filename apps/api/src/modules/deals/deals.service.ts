import { Injectable, NotFoundException } from "@nestjs/common";
import { allocatePublicNumber } from "../../common/public-number";
import { PrismaService } from "../../prisma/prisma.service";
import { OutboundService } from "../integrations/outbound.service";
import { LeadsService } from "../leads/leads.service";

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbound: OutboundService,
    private readonly leads: LeadsService,
  ) {}

  async board(organizationId: string, pipelineId?: string) {
    const pipeline = pipelineId
      ? await this.prisma.pipeline.findFirst({
          where: { id: pipelineId, organizationId },
          include: { stages: { orderBy: { position: "asc" } } },
        })
      : await this.prisma.pipeline.findFirst({
          where: { organizationId, isDefault: true },
          include: { stages: { orderBy: { position: "asc" } } },
        });
    if (!pipeline) throw new NotFoundException("Pipeline not found");
    const deals = await this.prisma.deal.findMany({
      where: { organizationId, pipelineId: pipeline.id },
      include: {
        contact: true,
        stage: true,
        owner: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return { pipeline, deals };
  }

  async addContactToStage(
    organizationId: string,
    input: { name: string; phone?: string; email?: string; stageId: string; pipelineId?: string },
  ) {
    const pipeline = input.pipelineId
      ? await this.prisma.pipeline.findFirst({
          where: { id: input.pipelineId, organizationId },
        })
      : await this.prisma.pipeline.findFirst({
          where: { organizationId, isDefault: true },
        });
    if (!pipeline) throw new NotFoundException("Pipeline not found");
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: input.stageId, pipelineId: pipeline.id },
    });
    if (!stage) throw new NotFoundException("Stage not found");

    const publicNumber = await allocatePublicNumber(this.prisma, organizationId, "contact");
    const contact = await this.prisma.contact.create({
      data: {
        organizationId,
        publicNumber,
        name: input.name,
        phone: input.phone || null,
        email: input.email || null,
        source: "pipeline",
      },
    });
    await this.outbound.emit(organizationId, "contact.created", contact);
    return this.leads.create(organizationId, {
      contactId: contact.id,
      source: "pipeline",
      status: "new",
      stageId: stage.id,
      pipelineId: pipeline.id,
    });
  }

  async create(
    organizationId: string,
    input: {
      contactId: string;
      pipelineId: string;
      stageId: string;
      title?: string;
      value?: number;
      ownerId?: string;
      expectedCloseDate?: string | null;
      leadId?: string;
    },
  ) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: input.contactId, organizationId },
    });
    const deal = await this.prisma.deal.create({
      data: {
        organizationId,
        contactId: input.contactId,
        pipelineId: input.pipelineId,
        stageId: input.stageId,
        title: input.title || contact?.name || "Oportunidad",
        value: input.value ?? 0,
        ownerId: input.ownerId,
        expectedCloseDate: input.expectedCloseDate
          ? new Date(input.expectedCloseDate)
          : null,
        leadId: input.leadId,
      },
      include: { contact: true, stage: true },
    });
    await this.outbound.emit(organizationId, "deal.created", deal);
    return deal;
  }

  async move(organizationId: string, id: string, stageId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, organizationId },
      include: { stage: true },
    });
    if (!deal) throw new NotFoundException("Deal not found");
    const updated = await this.prisma.deal.update({
      where: { id },
      data: { stageId },
      include: { contact: true, stage: true },
    });
    if (deal.leadId) {
      await this.prisma.lead.updateMany({
        where: { id: deal.leadId, organizationId },
        data: {
          stageId,
          pipelineId: updated.pipelineId,
          ...(updated.stage.isWon
            ? { status: "converted" }
            : updated.stage.isLost
              ? { status: "lost" }
              : {}),
        },
      });
    } else if (updated.stage.isWon) {
      await this.prisma.lead.updateMany({
        where: { contactId: deal.contactId, organizationId, status: { not: "converted" } },
        data: { status: "converted", stageId, pipelineId: updated.pipelineId },
      });
    }
    await this.outbound.emit(organizationId, "deal.stage_changed", {
      dealId: id,
      from: deal.stageId,
      to: stageId,
    });
    return updated;
  }

  update(
    organizationId: string,
    id: string,
    data: Partial<{ title: string; value: number; ownerId: string; expectedCloseDate: string | null }>,
  ) {
    return this.prisma.deal.update({
      where: { id },
      data: {
        title: data.title,
        value: data.value,
        ownerId: data.ownerId,
        expectedCloseDate: data.expectedCloseDate
          ? new Date(data.expectedCloseDate)
          : data.expectedCloseDate === null
            ? null
            : undefined,
      },
    });
  }
}
