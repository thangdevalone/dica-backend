import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.getOrThrow<string>("DATABASE_URL"),
        connectionTimeoutMillis: config.get<number>(
          "DB_CONNECTION_TIMEOUT_MS",
          5_000,
        ),
        idleTimeoutMillis: config.get<number>("DB_IDLE_TIMEOUT_MS", 30_000),
        max: config.get<number>("DB_POOL_MAX", 20),
        statement_timeout: config.get<number>(
          "DB_STATEMENT_TIMEOUT_MS",
          30_000,
        ),
        lock_timeout: config.get<number>("DB_LOCK_TIMEOUT_MS", 5_000),
        idle_in_transaction_session_timeout: config.get<number>(
          "DB_IDLE_TRANSACTION_TIMEOUT_MS",
          30_000,
        ),
      }),
      transactionOptions: {
        maxWait: config.get<number>("DB_CONNECTION_TIMEOUT_MS", 5_000),
        timeout: config.get<number>("DB_TRANSACTION_TIMEOUT_MS", 15_000),
      },
    });
  }
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
