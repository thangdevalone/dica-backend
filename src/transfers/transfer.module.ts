import { Module } from "@nestjs/common";
import { TransferController } from "./transfer.controller.js";
import { TransferService } from "./transfer.service.js";

@Module({ controllers: [TransferController], providers: [TransferService] })
export class TransferModule {}
