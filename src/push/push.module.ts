import { Module } from "@nestjs/common";
import { PushController } from "./push.controller.js";
import { PushService } from "./push.service.js";
import { InventoryModule } from "../inventory/inventory.module.js";

@Module({
  imports: [InventoryModule],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
