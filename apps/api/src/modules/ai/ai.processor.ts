import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { QUEUE } from "../../queue/queue.module";
import { AiService } from "./ai.service";

@Processor(QUEUE.AI)
export class AiProcessor extends WorkerHost {
  constructor(private readonly ai: AiService) {
    super();
  }

  async process(job: Job<{ organizationId: string; conversationId: number; chatwootContactId?: number }>) {
    return this.ai.replyToConversation(
      job.data.organizationId,
      job.data.conversationId,
      job.data.chatwootContactId,
    );
  }
}
