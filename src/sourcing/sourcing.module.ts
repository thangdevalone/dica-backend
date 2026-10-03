import { Module } from "@nestjs/common";
import { SourcingController } from "./sourcing.controller.js";
import { SourcingService } from "./sourcing.service.js";
@Module({ controllers: [SourcingController], providers: [SourcingService] })
export class SourcingModule {}
