import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { formSchema, publicFormSubmitSchema } from "@crm/shared";
import { FormsService } from "./forms.service";
import { CurrentUser, Public, Roles } from "../../common/decorators";
import { AuthUser } from "../../common/types";

@Controller("forms")
export class FormsController {
  constructor(private readonly forms: FormsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.forms.list(user.organizationId);
  }

  @Post()
  @Roles("owner", "admin")
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.forms.create(user.organizationId, formSchema.parse(body));
  }

  @Public()
  @Get("public/:slug")
  publicGet(@Param("slug") slug: string) {
    return this.forms.publicGet(slug);
  }

  @Public()
  @Post("public/:slug")
  submit(@Param("slug") slug: string, @Body() body: unknown) {
    return this.forms.submit(slug, publicFormSubmitSchema.parse(body));
  }
}
