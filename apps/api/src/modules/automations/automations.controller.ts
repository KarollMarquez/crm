import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { AutomationsService } from "./automations.service";
import { CurrentUser, Roles } from "../../common/decorators";
import { AuthUser } from "../../common/types";
import { PrismaService } from "../../prisma/prisma.service";

@Controller("automations")
export class AutomationsController {
  constructor(
    private readonly automations: AutomationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.automations.list(user.organizationId);
  }

  @Get("templates")
  templates() {
    return this.prisma.automationTemplate.findMany({ where: { isPublic: true } });
  }

  @Post()
  @Roles("owner", "admin")
  create(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      name: string;
      trigger: string;
      status?: "draft" | "active" | "paused";
      steps?: { type: string; config?: Record<string, unknown> }[];
    },
  ) {
    return this.automations.create(user.organizationId, body);
  }

  @Post("from-template/:slug")
  @Roles("owner", "admin")
  async fromTemplate(@CurrentUser() user: AuthUser, @Param("slug") slug: string) {
    const tpl = await this.prisma.automationTemplate.findUnique({ where: { slug } });
    if (!tpl) return { error: "Template not found" };
    return this.automations.create(user.organizationId, {
      name: tpl.name,
      trigger: tpl.trigger,
      status: "draft",
      steps: tpl.steps as { type: string; config?: Record<string, unknown> }[],
    });
  }

  @Patch(":id/status")
  @Roles("owner", "admin")
  status(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { status: "draft" | "active" | "paused" },
  ) {
    return this.automations.updateStatus(user.organizationId, id, body.status);
  }
}
