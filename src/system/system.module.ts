import { Module } from "@nestjs/common";
import { OutboxProcessor } from "./outbox.processor.js";
import { PushModule } from "../push/push.module.js";
import { SystemController } from "./system.controller.js";
import { SystemService } from "./system.service.js";

@Module({
  imports: [PushModule],
  controllers: [SystemController],
  providers: [SystemService, OutboxProcessor],
})
export class SystemModule {}
