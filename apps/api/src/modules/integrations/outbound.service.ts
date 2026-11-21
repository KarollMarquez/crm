import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { QUEUE } from "../../queue/queue.module";

@Injectable()
export class OutboundService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE.OUTBOUND) private readonly queue: Queue,
  ) {}

  async emit(organizationId: string, event: string, payload: unknown) {
    const hooks = await this.prisma.outboundWebhook.findMany({
      where: { organizationId, active: true, events: { has: event } },
    });
    for (const hook of hooks) {
      await this.queue.add("deliver", {
        url: hook.url,
        secret: hook.secret,
        event,
        payload,
        organizationId,
      });
    }
  }
}
