import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { json, urlencoded } from "express";
import helmet from "helmet";
import { Logger as PinoLogger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter.js";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor.js";
import { requestIdMiddleware } from "./common/middleware/request-id.middleware.js";
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
      bufferLogs: true,
      bodyParser: false,
    }),
    config = app.get(ConfigService);
  app.useLogger(app.get(PinoLogger));
  app.enableShutdownHooks();
  app.setGlobalPrefix("api/v1");
  const trustProxyHops = config.get<number>("TRUST_PROXY_HOPS", 0);
  if (trustProxyHops > 0) {
    const express = app.getHttpAdapter().getInstance() as {
      set(name: string, value: number): void;
    };
    express.set("trust proxy", trustProxyHops);
  }
  const bodyLimit = config.get<string>("HTTP_BODY_LIMIT", "10mb");
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));
  app.use(helmet());
  app.use(requestIdMiddleware);
  app.enableCors({
    origin: config
      .getOrThrow<string>("CORS_ORIGINS")
      .split(",")
      .map((x) => x.trim()),
    credentials: false,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  if (
    config.get("NODE_ENV") !== "production" ||
    config.get<boolean>("SWAGGER_ENABLED", false)
  ) {
    const docs = new DocumentBuilder()
      .setTitle("DICA Backend API")
      .setDescription(
        "API quản lý nguồn cấp, yêu cầu hàng, giao nhận và tồn kho DICA.",
      )
      .setVersion("1.0")
      .addBearerAuth()
      .addApiKey(
        { type: "apiKey", in: "header", name: "Idempotency-Key" },
        "idempotency",
      )
      .build();
    SwaggerModule.setup(
      "docs",
      app,
      () => SwaggerModule.createDocument(app, docs),
      { jsonDocumentUrl: "openapi.json" },
    );
  }
  await app.listen(config.get<number>("PORT", 3000), "0.0.0.0");
}
void bootstrap();
