import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export type SegmentFilter = {
  tagId?: string;
  lastInteractionDays?: number;
  stageSlug?: string;
  inboxId?: string;
};

@Injectable()
export class SegmentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.segment.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
  }

  create(organizationId: string, name: string, filters: SegmentFilter) {
    return this.prisma.segment.create({
      data: { organizationId, name, filters: filters as object },
    });
  }

  async evaluate(organizationId: string, filters: SegmentFilter) {
    const where: Prisma.ContactWhereInput = { organizationId };
    if (filters.tagId) where.tags = { some: { tagId: filters.tagId } };
    if (filters.inboxId) where.conversations = { some: { inboxId: filters.inboxId } };
    if (filters.stageSlug) {
      where.deals = { some: { stage: { slug: filters.stageSlug } } };
    }
    if (filters.lastInteractionDays) {
      const since = new Date();
      since.setDate(since.getDate() - filters.lastInteractionDays);
      where.OR = [
        { lastInteractionAt: { lt: since } },
        { lastInteractionAt: null },
      ];
    }
    return this.prisma.contact.findMany({
      where,
      include: { tags: { include: { tag: true } } },
    });
  }

  async members(organizationId: string, segmentId: string) {
    const segment = await this.prisma.segment.findFirst({
      where: { id: segmentId, organizationId },
    });
    if (!segment) return [];
    return this.evaluate(organizationId, segment.filters as SegmentFilter);
  }
}
