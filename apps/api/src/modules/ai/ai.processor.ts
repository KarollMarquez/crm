import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { QUEUE } from "../../queue/queue.module";
import { AiService } from "./ai.service";

// TODO: cuando InboxService propio esté listo, este job recibirá
// el historial de mensajes y el contactId desde el webhook de WhatsApp.
@Processor(QUEUE.AI)
export class AiProcessor extends WorkerHost {
  constructor(private readonly ai: AiService) {
    super();
  }

  async process(
    job: Job<{
      organizationId: string;
      messageHistory: { role: "user" | "assistant"; content: string }[];
      contactId?: string;
    }>,
  ) {
    return this.ai.replyToConversation(
      job.data.organizationId,
      job.data.messageHistory ?? [],
      job.data.contactId,
    );
  }
}
