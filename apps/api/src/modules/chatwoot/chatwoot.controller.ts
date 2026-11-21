import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { chatwootConnectSchema, sendMessageSchema } from "@crm/shared";
import type { Response } from "express";
import { ChatwootService, UploadedMedia } from "./chatwoot.service";
import { CurrentUser, Roles } from "../../common/decorators";
import { AuthUser } from "../../common/types";

const MAX_ATTACHMENT_BYTES = 40 * 1024 * 1024;

@Controller("chatwoot")
export class ChatwootController {
  constructor(private readonly chatwoot: ChatwootService) {}

  @Get("status")
  status(@CurrentUser() user: AuthUser) {
    return this.chatwoot.getStatus(user.organizationId);
  }

  @Post("connect")
  @Roles("owner", "admin")
  connect(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = chatwootConnectSchema.parse(body);
    return this.chatwoot.connect(user.organizationId, user.id, input);
  }

  @Delete("disconnect")
  @Roles("owner", "admin")
  disconnect(@CurrentUser() user: AuthUser) {
    return this.chatwoot.disconnect(user.organizationId, user.id);
  }

  @Post("sync")
  @Roles("owner", "admin")
  sync(@CurrentUser() user: AuthUser) {
    return this.chatwoot.syncContacts(user.organizationId);
  }

  @Get("contacts/:contactId/conversations")
  conversations(
    @CurrentUser() user: AuthUser,
    @Param("contactId") contactId: string,
  ) {
    return this.chatwoot.getConversations(user.organizationId, contactId);
  }

  @Get("attachments")
  async attachment(
    @CurrentUser() user: AuthUser,
    @Query("url") url: string,
    @Res() res: Response,
  ) {
    if (!url) throw new BadRequestException("url is required");
    await this.chatwoot.proxyAttachment(user.organizationId, url, res);
  }

  @Get("conversations/:id/messages")
  messages(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Query("before") before?: string,
  ) {
    return this.chatwoot.getMessages(
      user.organizationId,
      Number(id),
      before ? Number(before) : undefined,
    );
  }

  @Post("conversations/:id/messages")
  @UseInterceptors(
    FilesInterceptor("attachments", 8, { limits: { fileSize: MAX_ATTACHMENT_BYTES } }),
  )
  send(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { content?: string; private?: boolean | string },
    @UploadedFiles() files?: UploadedMedia[],
  ) {
    const uploads = (files || []).filter((file) => file?.buffer?.length);
    const content = typeof body?.content === "string" ? body.content : "";
    const isPrivate = body?.private === true || body?.private === "true";
    if (!uploads.length) {
      const input = sendMessageSchema.parse({ content, private: isPrivate });
      return this.chatwoot.sendMessage(
        user.organizationId,
        Number(id),
        input.content,
        input.private,
      );
    }
    return this.chatwoot.sendMessage(
      user.organizationId,
      Number(id),
      content.trim(),
      isPrivate,
      uploads,
    );
  }

  @Patch("conversations/:id/status")
  setStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { status: string },
  ) {
    return this.chatwoot.setStatus(user.organizationId, Number(id), body.status);
  }

  @Get("conversations/:id/open")
  async open(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return {
      url: await this.chatwoot.openInChatwootUrl(user.organizationId, Number(id)),
    };
  }
}
