import { Controller, Get, Query } from "@nestjs/common";
import { ChatwootService } from "../chatwoot/chatwoot.service";
import { CurrentUser } from "../../common/decorators";
import { AuthUser } from "../../common/types";

@Controller("inbox")
export class InboxController {
  constructor(private readonly chatwoot: ChatwootService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query("inboxId") inboxId?: string,
    @Query("status") status?: string,
    @Query("q") q?: string,
    @Query("assignee") assignee?: string,
  ) {
    return this.chatwoot.listInbox(user.organizationId, {
      inboxId,
      status,
      q,
      assignee,
    });
  }
}
