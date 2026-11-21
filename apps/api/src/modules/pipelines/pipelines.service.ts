import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { allocatePublicNumber, parsePublicNumber } from "../../common/public-number";
import { PrismaService } from "../../prisma/prisma.service";

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
export class PipelinesService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.pipeline.findMany({
      where: { organizationId },
      include: { stages: { orderBy: { position: "asc" } } },
    });
  }

  defaultPipeline(organizationId: string) {
    return this.prisma.pipeline.findFirst({
      where: { organizationId, isDefault: true },
      include: { stages: { orderBy: { position: "asc" } } },
    });
  }

  async assertPipeline(organizationId: string, pipelineId: string) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id: pipelineId, organizationId },
      include: { stages: { orderBy: { position: "asc" } } },
    });
    if (!pipeline) throw new NotFoundException("Pipeline not found");
    return pipeline;
  }

  private async stageId(organizationId: string, id: string) {
    const publicNumber = parsePublicNumber(id);
    const found = await this.prisma.pipelineStage.findFirst({
      where: {
        organizationId,
        ...(publicNumber != null ? { OR: [{ id }, { publicNumber }] } : { id }),
      },
      select: { id: true },
    });
    if (!found) throw new NotFoundException("Stage not found");
    return found.id;
  }

  async addStage(
    organizationId: string,
    pipelineId: string,
    input: { name: string; color?: string },
  ) {
    const pipeline = await this.assertPipeline(organizationId, pipelineId);
    const position = (pipeline.stages.at(-1)?.position ?? -1) + 1;
    const base = slugify(input.name);
    const slug = `${base}_${Date.now().toString(36)}`;
    const publicNumber = await allocatePublicNumber(this.prisma, organizationId, "stage");
    return this.prisma.pipelineStage.create({
      data: {
        organizationId,
        pipelineId,
        publicNumber,
        name: input.name,
        slug,
        position,
        color: input.color || "#64748b",
      },
    });
  }

  async updateStage(
    organizationId: string,
    stageId: string,
    input: { name?: string; color?: string; position?: number },
  ) {
    const id = await this.stageId(organizationId, stageId);
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id },
      include: { pipeline: true },
    });
    if (!stage || stage.pipeline.organizationId !== organizationId) {
      throw new NotFoundException("Stage not found");
    }
    return this.prisma.pipelineStage.update({
      where: { id },
      data: {
        name: input.name,
        color: input.color,
        position: input.position,
        slug: input.name ? `${slugify(input.name)}_${stage.position}` : undefined,
      },
    });
  }

  async deleteStage(organizationId: string, stageId: string) {
    const id = await this.stageId(organizationId, stageId);
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id },
      include: { pipeline: { include: { stages: { orderBy: { position: "asc" } } } } },
    });
    if (!stage || stage.pipeline.organizationId !== organizationId) {
      throw new NotFoundException("Stage not found");
    }
    if (stage.pipeline.stages.length <= 1) {
      throw new BadRequestException("Debe quedar al menos una etapa");
    }
    const fallback = stage.pipeline.stages.find((s) => s.id !== id);
    if (fallback) {
      await this.prisma.deal.updateMany({
        where: { stageId: id },
        data: { stageId: fallback.id },
      });
      await this.prisma.lead.updateMany({
        where: { stageId: id },
        data: { stageId: fallback.id, pipelineId: stage.pipelineId },
      });
    }
    await this.prisma.pipelineStage.delete({ where: { id } });
    return { ok: true };
  }

  async reorder(organizationId: string, pipelineId: string, stageIds: string[]) {
    await this.assertPipeline(organizationId, pipelineId);
    await this.prisma.$transaction(
      stageIds.map((id, position) =>
        this.prisma.pipelineStage.update({ where: { id }, data: { position } }),
      ),
    );
    return this.assertPipeline(organizationId, pipelineId);
  }
}
