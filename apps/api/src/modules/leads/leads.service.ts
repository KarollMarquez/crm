import { Injectable, NotFoundException } from "@nestjs/common";
import { LeadStatus } from "@prisma/client";
import { allocatePublicNumber, parsePublicNumber } from "../../common/public-number";
import { PrismaService } from "../../prisma/prisma.service";
import { OutboundService } from "../integrations/outbound.service";

const leadInclude = {
  contact: true,
  owner: { select: { id: true, name: true } },
  stage: true,
} as const;

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "etapa"
  );
}

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbound: OutboundService,
  ) {}

  async list(organizationId: string, query?: { status?: LeadStatus; contactId?: string }) {
    let contactId = query?.contactId;
    if (contactId) {
      const publicNumber = parsePublicNumber(contactId);
      const contact = await this.prisma.contact.findFirst({
        where: {
          organizationId,
          ...(publicNumber != null ? { OR: [{ id: contactId }, { publicNumber }] } : { id: contactId }),
        },
        select: { id: true },
      });
      contactId = contact?.id ?? "__none__";
    }
    return this.prisma.lead.findMany({
      where: {
        organizationId,
        ...(query?.status ? { status: query.status } : {}),
        ...(contactId ? { contactId } : {}),
      },
      include: leadInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  async get(organizationId: string, id: string) {
    const lead = await this.assertLead(organizationId, id);
    return this.prisma.lead.findFirstOrThrow({
      where: { id: lead.id, organizationId },
      include: { ...leadInclude, customFields: true },
    });
  }

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

    await this.backfillUnstaged(organizationId, pipeline.id, pipeline.stages[0]?.id);

    const leads = await this.prisma.lead.findMany({
      where: { organizationId, pipelineId: pipeline.id },
      include: leadInclude,
      orderBy: { updatedAt: "desc" },
    });
    return { pipeline, leads };
  }

  async create(
    organizationId: string,
    input: {
      contactId: string;
      status?: LeadStatus;
      source?: string;
      service?: string;
      value?: number;
      ownerId?: string;
      stageId?: string;
      pipelineId?: string;
    },
  ) {
    const placement = await this.resolvePlacement(organizationId, input.stageId, input.pipelineId);
    const publicNumber = await allocatePublicNumber(this.prisma, organizationId, "lead");
    const lead = await this.prisma.lead.create({
      data: {
        organizationId,
        publicNumber,
        contactId: input.contactId,
        status: input.status || "new",
        source: input.source,
        service: input.service,
        value: input.value ?? 0,
        ownerId: input.ownerId || null,
        pipelineId: placement?.pipelineId,
        stageId: placement?.stageId,
      },
      include: leadInclude,
    });
    if (placement) {
      await this.syncDealForLead(organizationId, lead.id, placement.pipelineId, placement.stageId);
    }
    await this.outbound.emit(organizationId, "lead.created", lead);
    return lead;
  }

  async ensureForContact(organizationId: string, contactId: string, source: string) {
    const existing = await this.prisma.lead.findFirst({
      where: { organizationId, contactId, status: { not: "converted" } },
    });
    if (existing) {
      if (!existing.stageId) {
        const placed = await this.placeOnPipeline(organizationId, existing.id);
        return { lead: placed, created: false };
      }
      return { lead: existing, created: false };
    }
    const lead = await this.create(organizationId, { contactId, source, status: "new" });
    return { lead, created: true };
  }

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      status: LeadStatus;
      service: string | null;
      value: number;
      ownerId: string | null;
      source: string | null;
      stageId: string;
      stage: string | number;
    }>,
  ) {
    const lead = await this.assertLead(organizationId, id);
    const { stageId, stage, ...fields } = data;
    const resolvedStageId = await this.resolveStageId(organizationId, stageId, stage);
    const updated = await this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: fields.status,
        service: fields.service,
        source: fields.source,
        value: fields.value,
        ownerId: fields.ownerId === undefined ? undefined : fields.ownerId || null,
      },
      include: leadInclude,
    });
    if (resolvedStageId) return this.move(organizationId, lead.id, resolvedStageId);
    return updated;
  }

  async move(organizationId: string, id: string, stageId: string) {
    const lead = await this.assertLead(organizationId, id);
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: stageId },
      include: { pipeline: true },
    });
    if (!stage || stage.pipeline.organizationId !== organizationId) {
      throw new NotFoundException("Stage not found");
    }
    const status = stage.isWon ? "converted" : stage.isLost ? "lost" : undefined;
    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        stageId: stage.id,
        pipelineId: stage.pipelineId,
        ...(status ? { status } : {}),
      },
      include: leadInclude,
    });
    await this.syncDealForLead(organizationId, lead.id, stage.pipelineId, stage.id);
    await this.outbound.emit(organizationId, "lead.stage_changed", {
      leadId: id,
      from: lead.stageId,
      to: stageId,
    });
    return updated;
  }

  private async resolveStageId(
    organizationId: string,
    stageId?: string,
    stage?: string | number,
  ) {
    const publicFromStageId = stageId ? parsePublicNumber(stageId) : null;
    if (stageId && publicFromStageId == null) return stageId;
    const token = publicFromStageId != null ? stageId : stage == null ? undefined : String(stage);
    if (!token) return undefined;
    const publicNumber = parsePublicNumber(token);
    const stages = await this.prisma.pipelineStage.findMany({
      where: { organizationId },
      include: { pipeline: true },
    });
    const ranked = [...stages].sort((a, b) => Number(b.pipeline.isDefault) - Number(a.pipeline.isDefault));
    if (publicNumber != null) {
      const match = ranked.find((s) => s.publicNumber === publicNumber);
      if (!match) throw new NotFoundException("Stage not found");
      return match.id;
    }
    const normalized = token.trim().toLowerCase();
    const match =
      ranked.find((s) => s.slug.toLowerCase() === normalized) ||
      ranked.find((s) => s.slug.toLowerCase().startsWith(`${normalized}_`)) ||
      ranked.find((s) => slugify(s.name) === normalized);
    if (!match) throw new NotFoundException("Stage not found");
    return match.id;
  }

  private async placeOnPipeline(organizationId: string, leadId: string) {
    const placement = await this.resolvePlacement(organizationId);
    if (!placement) {
      return this.prisma.lead.findFirstOrThrow({
        where: { id: leadId, organizationId },
        include: leadInclude,
      });
    }
    const updated = await this.prisma.lead.update({
      where: { id: leadId },
      data: { pipelineId: placement.pipelineId, stageId: placement.stageId },
      include: leadInclude,
    });
    await this.syncDealForLead(organizationId, leadId, placement.pipelineId, placement.stageId);
    return updated;
  }

  private async resolvePlacement(organizationId: string, stageId?: string, pipelineId?: string) {
    if (stageId) {
      const stage = await this.prisma.pipelineStage.findFirst({
        where: { id: stageId },
        include: { pipeline: true },
      });
      if (!stage || stage.pipeline.organizationId !== organizationId) {
        throw new NotFoundException("Stage not found");
      }
      if (pipelineId && stage.pipelineId !== pipelineId) {
        throw new NotFoundException("Stage not found");
      }
      return { pipelineId: stage.pipelineId, stageId: stage.id };
    }
    const pipeline = pipelineId
      ? await this.prisma.pipeline.findFirst({
          where: { id: pipelineId, organizationId },
          include: { stages: { orderBy: { position: "asc" } } },
        })
      : await this.prisma.pipeline.findFirst({
          where: { organizationId, isDefault: true },
          include: { stages: { orderBy: { position: "asc" } } },
        });
    const stage = pipeline?.stages[0];
    if (!pipeline || !stage) return null;
    return { pipelineId: pipeline.id, stageId: stage.id };
  }

  private async backfillUnstaged(organizationId: string, pipelineId: string, firstStageId?: string) {
    if (!firstStageId) return;
    const unstaged = await this.prisma.lead.findMany({
      where: { organizationId, OR: [{ stageId: null }, { pipelineId: null }] },
      select: { id: true },
    });
    if (!unstaged.length) return;
    await this.prisma.lead.updateMany({
      where: { id: { in: unstaged.map((l) => l.id) } },
      data: { pipelineId, stageId: firstStageId },
    });
    for (const row of unstaged) {
      await this.syncDealForLead(organizationId, row.id, pipelineId, firstStageId);
    }
  }

  private async syncDealForLead(
    organizationId: string,
    leadId: string,
    pipelineId: string,
    stageId: string,
  ) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId },
      include: { contact: true },
    });
    if (!lead) return;
    const existing = await this.prisma.deal.findFirst({
      where: { organizationId, leadId },
    });
    if (existing) {
      await this.prisma.deal.update({
        where: { id: existing.id },
        data: {
          stageId,
          pipelineId,
          value: lead.value,
          ownerId: lead.ownerId,
        },
      });
      return;
    }
    await this.prisma.deal.create({
      data: {
        organizationId,
        contactId: lead.contactId,
        pipelineId,
        stageId,
        title: lead.contact.name,
        value: lead.value,
        ownerId: lead.ownerId,
        leadId: lead.id,
      },
    });
  }

  async setField(organizationId: string, leadId: string, key: string, value: string) {
    const lead = await this.assertLead(organizationId, leadId);
    return this.prisma.leadCustomField.upsert({
      where: { leadId_key: { leadId: lead.id, key } },
      create: { organizationId, leadId: lead.id, key, value },
      update: { value },
    });
  }

  async deleteField(organizationId: string, leadId: string, fieldId: string) {
    const lead = await this.assertLead(organizationId, leadId);
    return this.prisma.leadCustomField.deleteMany({
      where: { id: fieldId, leadId: lead.id, organizationId },
    });
  }

  async delete(organizationId: string, id: string) {
    const lead = await this.assertLead(organizationId, id);
    await this.prisma.$transaction(async (tx) => {
      const deals = await tx.deal.findMany({
        where: { organizationId, leadId: lead.id },
        select: { id: true },
      });
      const dealIds = deals.map((deal) => deal.id);
      if (dealIds.length) {
        await tx.task.updateMany({ where: { dealId: { in: dealIds } }, data: { dealId: null } });
        await tx.deal.deleteMany({ where: { id: { in: dealIds } } });
      }
      await tx.appointment.updateMany({
        where: { organizationId, leadId: lead.id },
        data: { leadId: null },
      });
      await tx.leadCustomField.deleteMany({ where: { leadId: lead.id } });
      await tx.lead.delete({ where: { id: lead.id } });
    });
    await this.outbound.emit(organizationId, "lead.deleted", {
      leadId: lead.id,
      publicNumber: lead.publicNumber,
      contactId: lead.contactId,
    });
    return { ok: true };
  }

  private async assertLead(organizationId: string, id: string) {
    const publicNumber = parsePublicNumber(id);
    const lead = await this.prisma.lead.findFirst({
      where: {
        organizationId,
        ...(publicNumber != null ? { OR: [{ id }, { publicNumber }] } : { id }),
      },
    });
    if (!lead) throw new NotFoundException("Lead not found");
    return lead;
  }
}
