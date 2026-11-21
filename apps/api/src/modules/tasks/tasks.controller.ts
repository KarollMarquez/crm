import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { taskSchema } from "@crm/shared";
import { TaskStatus } from "@prisma/client";
import { TasksService } from "./tasks.service";
import { CurrentUser, Roles } from "../../common/decorators";
import { AuthUser } from "../../common/types";

@Controller("tasks")
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("status") status?: TaskStatus) {
    return this.tasks.list(user.organizationId, status);
  }

  @Post()
  @Roles("owner", "admin", "agent")
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.tasks.create(user.organizationId, taskSchema.parse(body));
  }

  @Patch(":id")
  @Roles("owner", "admin", "agent")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: unknown) {
    return this.tasks.update(user.organizationId, id, taskSchema.partial().parse(body));
  }
}
