import { Module } from "@nestjs/common";
import { AttachmentController } from "./attachment.controller.js";
import { AttachmentService } from "./attachment.service.js";
import { R2StorageService } from "./r2-storage.service.js";

@Module({
  controllers: [AttachmentController],
  providers: [AttachmentService, R2StorageService],
})
export class AttachmentModule {}
