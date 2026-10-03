import { Module } from "@nestjs/common";
import { OperationController } from "./operation.controller.js";
import { OperationService } from "./operation.service.js";

@Module({ controllers: [OperationController], providers: [OperationService] })
export class OperationModule {}
