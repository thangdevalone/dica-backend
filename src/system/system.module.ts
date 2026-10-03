import { Module } from "@nestjs/common";
import { OutboxProcessor } from "./outbox.processor.js";
import { SystemController } from "./system.controller.js";
import { SystemService } from "./system.service.js";

@Module({
  controllers: [SystemController],
  providers: [SystemService, OutboxProcessor],
})
export class SystemModule {}
