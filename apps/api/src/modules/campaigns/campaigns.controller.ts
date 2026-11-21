import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { campaignSchema } from "@crm/shared";
import { CampaignsService } from "./campaigns.service";
import { CurrentUser, Roles } from "../../common/decorators";
import { AuthUser } from "../../common/types";

@Controller("campaigns")
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.campaigns.list(user.organizationId);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.campaigns.get(user.organizationId, id);
  }

  @Post()
  @Roles("owner", "admin")
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.campaigns.create(user.organizationId, campaignSchema.parse(body));
  }

  @Post(":id/launch")
  @Roles("owner", "admin")
  launch(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.campaigns.launch(user.organizationId, id);
  }
}
