import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { QUEUE } from "../../queue/queue.module";
import { AutomationsService } from "./automations.service";

@Processor(QUEUE.AUTOMATIONS)
export class AutomationsProcessor extends WorkerHost {
  constructor(private readonly automations: AutomationsService) {
    super();
  }

  async process(job: Job) {
    if (job.name === "resume") {
      return this.automations.resume(job.data.runId, job.data.fromStep);
    }
    return this.automations.handleTrigger(job.data);
  }
}
