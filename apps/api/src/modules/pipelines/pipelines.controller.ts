import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { PipelinesService } from "./pipelines.service";
import { CurrentUser, Roles } from "../../common/decorators";
import { AuthUser } from "../../common/types";

@Controller("pipelines")
export class PipelinesController {
  constructor(private readonly pipelines: PipelinesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.pipelines.list(user.organizationId);
  }

  @Post(":id/stages")
  @Roles("owner", "admin")
  addStage(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { name: string; color?: string },
  ) {
    return this.pipelines.addStage(user.organizationId, id, body);
  }

  @Patch("stages/:stageId")
  @Roles("owner", "admin")
  updateStage(
    @CurrentUser() user: AuthUser,
    @Param("stageId") stageId: string,
    @Body() body: { name?: string; color?: string; position?: number },
  ) {
    return this.pipelines.updateStage(user.organizationId, stageId, body);
  }

  @Delete("stages/:stageId")
  @Roles("owner", "admin")
  deleteStage(@CurrentUser() user: AuthUser, @Param("stageId") stageId: string) {
    return this.pipelines.deleteStage(user.organizationId, stageId);
  }

  @Post(":id/reorder")
  @Roles("owner", "admin")
  reorder(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { stageIds: string[] },
  ) {
    return this.pipelines.reorder(user.organizationId, id, body.stageIds);
  }
}
