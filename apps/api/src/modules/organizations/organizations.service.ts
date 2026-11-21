import { Injectable } from "@nestjs/common";
import { Plan } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  get(organizationId: string) {
    return this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { branding: true, subscription: true },
    });
  }

  updateBranding(
    organizationId: string,
    data: { appName?: string; logoUrl?: string; primaryColor?: string; accentColor?: string },
  ) {
    return this.prisma.organizationBranding.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    });
  }

  updatePlan(organizationId: string, plan: Plan) {
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: { plan },
    });
  }

  webhooks(organizationId: string) {
    return this.prisma.outboundWebhook.findMany({
      where: { organizationId },
      select: { id: true, url: true, events: true, active: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  createWebhook(organizationId: string, url: string, events: string[], secret: string) {
    return this.prisma.outboundWebhook.create({
      data: { organizationId, url, events, secret },
    });
  }

  async deleteWebhook(organizationId: string, id: string) {
    await this.prisma.outboundWebhook.deleteMany({ where: { id, organizationId } });
    return { ok: true };
  }
}
