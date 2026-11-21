import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { contactSchema } from "@crm/shared";
import { ContactsService } from "./contacts.service";
import { CurrentUser, Roles } from "../../common/decorators";
import { AuthUser } from "../../common/types";

@Controller("contacts")
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query("q") q?: string,
    @Query("tagId") tagId?: string,
    @Query("inboxId") inboxId?: string,
    @Query("phone") phone?: string,
    @Query("email") email?: string,
    @Query("chatwootContactId") chatwootContactId?: string,
  ) {
    return this.contacts.list(user.organizationId, {
      q,
      tagId,
      inboxId,
      phone,
      email,
      chatwootContactId,
    });
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.contacts.get(user.organizationId, id);
  }

  @Post()
  @Roles("owner", "admin", "agent")
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.contacts.create(user.organizationId, contactSchema.parse(body));
  }

  @Patch(":id")
  @Roles("owner", "admin", "agent")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.contacts.update(user.organizationId, id, contactSchema.partial().parse(body));
  }

  @Post(":id/fields")
  @Roles("owner", "admin", "agent")
  setField(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { key: string; value: string },
  ) {
    return this.contacts.setField(user.organizationId, id, body.key, body.value);
  }

  @Delete(":id/fields/:fieldId")
  @Roles("owner", "admin", "agent")
  deleteField(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("fieldId") fieldId: string,
  ) {
    return this.contacts.deleteField(user.organizationId, id, fieldId);
  }

  @Post(":id/notes")
  @Roles("owner", "admin", "agent")
  note(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { body: string },
  ) {
    return this.contacts.addNote(user.organizationId, id, body.body);
  }

  @Post(":id/tags/:tagId")
  @Roles("owner", "admin", "agent")
  addTag(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("tagId") tagId: string,
  ) {
    return this.contacts.addTag(user.organizationId, id, tagId);
  }

  @Delete(":id/tags/:tagId")
  @Roles("owner", "admin", "agent")
  removeTag(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("tagId") tagId: string,
  ) {
    return this.contacts.removeTag(user.organizationId, id, tagId);
  }

  @Delete(":id")
  @Roles("owner", "admin")
  delete(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.contacts.delete(user.organizationId, id);
  }
}
