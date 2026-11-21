import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";

export const QUEUE = {
  CHATWOOT_SYNC: "chatwoot-sync",
  WEBHOOKS: "webhooks",
  CAMPAIGNS: "campaigns",
  AUTOMATIONS: "automations",
  AI: "ai",
  OUTBOUND: "outbound-webhooks",
} as const;

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: new URL(process.env.REDIS_URL || "redis://localhost:6379").hostname,
        port: Number(
          new URL(process.env.REDIS_URL || "redis://localhost:6379").port || 6379,
        ),
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE.CHATWOOT_SYNC },
      { name: QUEUE.WEBHOOKS },
      { name: QUEUE.CAMPAIGNS },
      { name: QUEUE.AUTOMATIONS },
      { name: QUEUE.AI },
      { name: QUEUE.OUTBOUND },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
