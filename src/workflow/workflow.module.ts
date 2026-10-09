import { Module } from "@nestjs/common";
import { PushModule } from "../push/push.module.js";
import { AttachmentModule } from "../attachments/attachment.module.js";
import { WorkflowController } from "./workflow.controller.js";
import { WorkflowService } from "./workflow.service.js";
import { WorkflowWorker } from "./workflow.worker.js";
import { PurgeService } from "./purge.service.js";

@Module({
  imports: [PushModule, AttachmentModule],
  controllers: [WorkflowController],
  providers: [WorkflowService, WorkflowWorker, PurgeService],
})
export class WorkflowModule {}
