import { Body, Controller, Headers, Post } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../../common/decorators";
import { ChatwootService } from "../chatwoot/chatwoot.service";

@SkipThrottle()
@Controller("webhooks")
export class WebhooksController {
  constructor(private readonly chatwoot: ChatwootService) {}

  @Public()
  @Post("chatwoot")
  handle(
    @Body() body: Record<string, unknown>,
    @Headers("x-chatwoot-secret") secret?: string,
    @Headers("x-webhook-secret") alt?: string,
  ) {
    return this.chatwoot.handleWebhook(secret || alt, body);
  }
}
