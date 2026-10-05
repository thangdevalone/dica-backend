import assert from "node:assert/strict";
import test from "node:test";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AuthController } from "../src/auth/auth.controller.js";
import { AuthService } from "../src/auth/auth.service.js";
import type { LoginDto } from "../src/auth/dto/login.dto.js";
import type { Request } from "express";

@Module({
  controllers: [AuthController],
  providers: [{ provide: AuthService, useValue: {} }],
})
class AuthTestModule {}

test("backend tự lấy User-Agent từ request khi đăng nhập", () => {
  let client: { ipAddress?: string; userAgent?: string } | undefined;
  const auth = {
    login: (_dto: LoginDto, loginClient: typeof client) => {
      client = loginClient;
    },
  } as unknown as AuthService;
  const controller = new AuthController(auth);
  const request = {
    get: (name: string) =>
      name.toLowerCase() === "user-agent" ? "Swagger UI" : undefined,
  } as unknown as Request;

  controller.login(
    {
      organization_code: "DICA",
      username: "admin",
      password: "secret",
    },
    "127.0.0.1",
    request,
  );

  assert.deepEqual(client, {
    ipAddress: "127.0.0.1",
    userAgent: "Swagger UI",
  });
});

test("Swagger không yêu cầu frontend nhập User-Agent khi đăng nhập", async () => {
  const app = await NestFactory.create(AuthTestModule, { logger: false });
  try {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    const login = document.paths["/auth/login"]?.post;

    assert.ok(login);
    assert.equal(
      login.parameters?.some(
        (parameter) =>
          "name" in parameter && parameter.name.toLowerCase() === "user-agent",
      ) ?? false,
      false,
    );
  } finally {
    await app.close();
  }
});
