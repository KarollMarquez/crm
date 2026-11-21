import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { QUEUE } from "../../queue/queue.module";
import { ChatwootService } from "./chatwoot.service";

@Processor(QUEUE.CHATWOOT_SYNC)
export class ChatwootProcessor extends WorkerHost {
  constructor(private readonly chatwoot: ChatwootService) {
    super();
  }

  async process(job: Job<{ organizationId: string }>) {
    return this.chatwoot.syncContacts(job.data.organizationId);
  }
}
