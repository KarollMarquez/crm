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

function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(redisUrl);
  const isTls = parsed.protocol === "rediss:";
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    password: parsed.password || undefined,
    ...(isTls ? { tls: {} } : {}),
  };
}

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: getRedisConnection(),
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
