import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { createHmac } from "crypto";
import { QUEUE } from "../../queue/queue.module";

@Processor(QUEUE.OUTBOUND)
export class OutboundProcessor extends WorkerHost {
  async process(
    job: Job<{ url: string; secret: string; event: string; payload: unknown }>,
  ) {
    const body = JSON.stringify({ event: job.data.event, data: job.data.payload });
    const signature = createHmac("sha256", job.data.secret).update(body).digest("hex");
    await fetch(job.data.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CRM-Signature": signature,
      },
      body,
    });
  }
}
