import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { aiAgentSchema } from "@crm/shared";
import { AiService } from "./ai.service";
import { CurrentUser, Roles } from "../../common/decorators";
import { AuthUser } from "../../common/types";

@Controller("ai-agents")
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.ai.list(user.organizationId);
  }

  @Post()
  @Roles("owner", "admin")
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.ai.create(user.organizationId, aiAgentSchema.parse(body));
  }

  @Patch(":id")
  @Roles("owner", "admin")
  update(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.ai.update(id, body);
  }

  @Post(":id/knowledge")
  @Roles("owner", "admin")
  knowledge(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { title: string; content: string },
  ) {
    return this.ai.addKnowledge(user.organizationId, id, body.title, body.content);
  }
}
