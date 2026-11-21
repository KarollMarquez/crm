import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { apiKeySchema } from "@crm/shared";
import { OrganizationsService } from "./organizations.service";
import { ApiKeysService } from "../public-api/api-keys.service";
import { CurrentUser, Roles } from "../../common/decorators";
import { AuthUser } from "../../common/types";
import { randomToken } from "../../common/crypto";

@Controller("settings")
export class OrganizationsController {
  constructor(
    private readonly orgs: OrganizationsService,
    private readonly keys: ApiKeysService,
  ) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.orgs.get(user.organizationId);
  }

  @Post("branding")
  @Roles("owner", "admin")
  branding(
    @CurrentUser() user: AuthUser,
    @Body()
    body: { appName?: string; logoUrl?: string; primaryColor?: string; accentColor?: string },
  ) {
    return this.orgs.updateBranding(user.organizationId, body);
  }

  @Get("webhooks")
  webhooks(@CurrentUser() user: AuthUser) {
    return this.orgs.webhooks(user.organizationId);
  }

  @Post("webhooks")
  @Roles("owner", "admin")
  createWebhook(
    @CurrentUser() user: AuthUser,
    @Body() body: { url: string; events: string[] },
  ) {
    return this.orgs.createWebhook(
      user.organizationId,
      body.url,
      body.events,
      randomToken(16),
    );
  }

  @Delete("webhooks/:id")
  @Roles("owner", "admin")
  deleteWebhook(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.orgs.deleteWebhook(user.organizationId, id);
  }

  @Get("api-keys")
  apiKeys(@CurrentUser() user: AuthUser) {
    return this.keys.list(user.organizationId);
  }

  @Post("api-keys")
  @Roles("owner", "admin")
  createKey(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = apiKeySchema.parse(body);
    return this.keys.create(user.organizationId, user.id, input.name, input.scopes);
  }

  @Post("api-keys/:id/revoke")
  @Roles("owner", "admin")
  revoke(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.keys.revoke(user.organizationId, id, user.id);
  }
}
