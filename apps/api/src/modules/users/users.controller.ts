import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { inviteUserSchema, updateUserSchema } from "@crm/shared";
import { OrganizationRole } from "@prisma/client";
import { UsersService } from "./users.service";
import { CurrentUser, Roles } from "../../common/decorators";
import { AuthUser } from "../../common/types";

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.users.list(user.organizationId);
  }

  @Post()
  @Roles("owner", "admin")
  invite(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.users.invite(user.organizationId, user.id, inviteUserSchema.parse(body));
  }

  @Patch(":id")
  @Roles("owner", "admin")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: unknown) {
    return this.users.update(user.organizationId, id, updateUserSchema.parse(body), user.id);
  }

  @Patch(":id/role")
  @Roles("owner", "admin")
  role(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { role: OrganizationRole },
  ) {
    return this.users.updateRole(user.organizationId, id, body.role, user.id);
  }

  @Delete(":id")
  @Roles("owner", "admin")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.users.remove(user.organizationId, id, user.id);
  }
}
