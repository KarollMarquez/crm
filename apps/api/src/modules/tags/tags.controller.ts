import { Body, Controller, Get, Post } from "@nestjs/common";
import { tagSchema } from "@crm/shared";
import { TagsService } from "./tags.service";
import { CurrentUser, Roles } from "../../common/decorators";
import { AuthUser } from "../../common/types";

@Controller("tags")
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.tags.list(user.organizationId);
  }

  @Post()
  @Roles("owner", "admin", "agent")
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = tagSchema.parse(body);
    return this.tags.create(user.organizationId, input.name, input.color);
  }
}
