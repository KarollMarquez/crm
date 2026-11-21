import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { dealSchema } from "@crm/shared";
import { DealsService } from "./deals.service";
import { CurrentUser, Roles } from "../../common/decorators";
import { AuthUser } from "../../common/types";

@Controller("deals")
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Get()
  board(@CurrentUser() user: AuthUser, @Query("pipelineId") pipelineId?: string) {
    return this.deals.board(user.organizationId, pipelineId);
  }

  @Post("leads")
  @Roles("owner", "admin", "agent")
  addLead(
    @CurrentUser() user: AuthUser,
    @Body() body: { name: string; phone?: string; email?: string; stageId: string; pipelineId?: string },
  ) {
    return this.deals.addContactToStage(user.organizationId, body);
  }

  @Post()
  @Roles("owner", "admin", "agent")
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.deals.create(user.organizationId, dealSchema.parse(body));
  }

  @Patch(":id")
  @Roles("owner", "admin", "agent")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: unknown) {
    const parsed = dealSchema.partial().parse(body);
    if (parsed.stageId) return this.deals.move(user.organizationId, id, parsed.stageId);
    return this.deals.update(user.organizationId, id, parsed);
  }
}
