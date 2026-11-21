import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { leadSchema, leadUpdateSchema } from "@crm/shared";
import { LeadStatus } from "@prisma/client";
import { LeadsService } from "./leads.service";
import { CurrentUser, Roles } from "../../common/decorators";
import { AuthUser } from "../../common/types";

@Controller("leads")
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get("board")
  board(@CurrentUser() user: AuthUser, @Query("pipelineId") pipelineId?: string) {
    return this.leads.board(user.organizationId, pipelineId);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query("status") status?: LeadStatus,
    @Query("contactId") contactId?: string,
  ) {
    return this.leads.list(user.organizationId, { status, contactId });
  }

  @Post()
  @Roles("owner", "admin", "agent")
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.leads.create(user.organizationId, leadSchema.parse(body));
  }

  @Patch(":id")
  @Roles("owner", "admin", "agent")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: unknown) {
    return this.leads.update(user.organizationId, id, leadUpdateSchema.parse(body));
  }

  @Post(":id/fields")
  @Roles("owner", "admin", "agent")
  setField(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { key: string; value: string },
  ) {
    return this.leads.setField(user.organizationId, id, body.key, body.value);
  }

  @Delete(":id/fields/:fieldId")
  @Roles("owner", "admin", "agent")
  deleteField(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("fieldId") fieldId: string,
  ) {
    return this.leads.deleteField(user.organizationId, id, fieldId);
  }

  @Delete(":id")
  @Roles("owner", "admin", "agent")
  delete(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.leads.delete(user.organizationId, id);
  }
}
