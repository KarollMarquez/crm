import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { SegmentFilter, SegmentsService } from "./segments.service";
import { CurrentUser, Roles } from "../../common/decorators";
import { AuthUser } from "../../common/types";

@Controller("segments")
export class SegmentsController {
  constructor(private readonly segments: SegmentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.segments.list(user.organizationId);
  }

  @Post()
  @Roles("owner", "admin")
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: { name: string; filters: SegmentFilter },
  ) {
    return this.segments.create(user.organizationId, body.name, body.filters);
  }

  @Get(":id/members")
  members(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.segments.members(user.organizationId, id);
  }
}
