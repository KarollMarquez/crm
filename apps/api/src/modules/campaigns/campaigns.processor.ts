import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { QUEUE } from "../../queue/queue.module";
import { CampaignsService } from "./campaigns.service";

@Processor(QUEUE.CAMPAIGNS)
export class CampaignsProcessor extends WorkerHost {
  constructor(private readonly campaigns: CampaignsService) {
    super();
  }

  async process(job: Job<{ organizationId: string; campaignId: string }>) {
    return this.campaigns.processSend(job.data.organizationId, job.data.campaignId);
  }
}
