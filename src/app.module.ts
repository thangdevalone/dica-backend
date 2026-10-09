import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { randomUUID } from "node:crypto";
import { LoggerModule } from "nestjs-pino";
import { AuthModule } from "./auth/auth.module.js";
import { AttachmentModule } from "./attachments/attachment.module.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { ConfigAuditInterceptor } from "./common/audit/config-audit.interceptor.js";
import { IdempotencyModule } from "./common/idempotency/idempotency.module.js";
import { envSchema } from "./config/env.validation.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { DeliveryModule } from "./delivery/delivery.module.js";
import { HealthModule } from "./health/health.module.js";
import { InventoryModule } from "./inventory/inventory.module.js";
import { IposModule } from "./ipos/ipos.module.js";
import { OrderModule } from "./orders/order.module.js";
import { OperationModule } from "./operations/operation.module.js";
import { OrganizationModule } from "./organization/organization.module.js";
import { RequestModule } from "./requests/request.module.js";
import { ReportingModule } from "./reporting/reporting.module.js";
import { SourcingModule } from "./sourcing/sourcing.module.js";
import { SystemModule } from "./system/system.module.js";
import { TransferModule } from "./transfers/transfer.module.js";
import { UserModule } from "./users/user.module.js";
import { WorkflowModule } from "./workflow/workflow.module.js";
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: envSchema,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const production = config.get("NODE_ENV") === "production";
        return {
          pinoHttp: {
            level: config.get<string>("LOG_LEVEL", "info"),
            ...(production
              ? {}
              : {
                  transport: {
                    target: "pino-pretty",
                    options: {
                      colorize: true,
                      singleLine: true,
                      translateTime: "SYS:standard",
                      ignore: "pid,hostname",
                    },
                  },
                }),
            genReqId: (req, res) => {
              const supplied = req.headers["x-request-id"];
              const id =
                typeof supplied === "string" &&
                /^[\w.:-]{1,100}$/.test(supplied)
                  ? supplied
                  : randomUUID();
              res.setHeader("x-request-id", id);
              return id;
            },
            customProps: (req) => ({ request_id: req.id }),
            customLogLevel: (_req, res, error) => {
              if (error || res.statusCode >= 500) return "error" as const;
              if (res.statusCode >= 400) return "warn" as const;
              return "info" as const;
            },
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "res.headers.set-cookie",
                "password",
                "password_hash",
                "access_token",
                "refresh_token",
                "token",
                "secret",
              ],
              censor: "[REDACTED]",
            },
          },
        };
      },
    }),
    ThrottlerModule.forRoot([{ name: "default", ttl: 60000, limit: 120 }]),
    DatabaseModule,
    IdempotencyModule,
    AuthModule,
    AttachmentModule,
    HealthModule,
    OrganizationModule,
    CatalogModule,
    SourcingModule,
    RequestModule,
    OrderModule,
    DeliveryModule,
    InventoryModule,
    UserModule,
    WorkflowModule,
    TransferModule,
    OperationModule,
    ReportingModule,
    SystemModule,
    IposModule,
    DashboardModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: ConfigAuditInterceptor },
  ],
})
export class AppModule {}
