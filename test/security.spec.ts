import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { envSchema } from "../src/config/env.validation.js";

const validEnvironment = {
  DATABASE_URL: "postgresql://user:password@localhost:5432/dica",
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  R2_ACCOUNT_ID: "account-id",
  R2_ACCESS_KEY_ID: "access-key-id",
  R2_SECRET_ACCESS_KEY: "secret-access-key",
  R2_BUCKET: "dica-attachments",
};

test("từ chối JWT secret mặc định hoặc dùng chung", () => {
  const placeholder = envSchema.validate({
    ...validEnvironment,
    JWT_ACCESS_SECRET: "replace-with-at-least-32-random-characters",
  });
  assert.ok(placeholder.error);

  const reused = envSchema.validate({
    ...validEnvironment,
    JWT_REFRESH_SECRET: validEnvironment.JWT_ACCESS_SECRET,
  });
  assert.ok(reused.error);
});

test("mọi business route đều khai báo permission hoặc public rõ ràng", () => {
  const controllerFiles = filesUnder(path.resolve("src")).filter((file) =>
    file.endsWith(".controller.ts"),
  );
  const missing: string[] = [];
  for (const file of controllerFiles) {
    if (
      file.endsWith(`${path.sep}auth${path.sep}auth.controller.ts`) ||
      file.endsWith(`${path.sep}health${path.sep}health.controller.ts`)
    )
      continue;
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    ts.forEachChild(source, (node) => {
      if (!ts.isClassDeclaration(node)) return;
      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member)) continue;
        const decorators =
          (ts.canHaveDecorators(member) ? ts.getDecorators(member) : []) ?? [];
        const names = decorators.map((decorator) =>
          decorator.expression.getText(source),
        );
        const isRoute = names.some((name) =>
          /^(?:Get|Post|Put|Patch|Delete)\(/.test(name),
        );
        const protectedRoute = names.some(
          (name) =>
            name.startsWith("RequirePermissions(") ||
            name.startsWith("Public("),
        );
        if (isRoute && !protectedRoute)
          missing.push(
            `${path.relative(process.cwd(), file)}:${member.name.getText(source)}`,
          );
      }
    });
  }
  assert.deepEqual(missing, []);
});

test("FCM can stay disabled without credentials and requires a service account when enabled", () => {
  assert.equal(
    envSchema.validate({ ...validEnvironment, FCM_ENABLED: false }).error,
    undefined,
  );
  assert.ok(
    envSchema.validate({ ...validEnvironment, FCM_ENABLED: true }).error,
  );
  assert.equal(
    envSchema.validate({
      ...validEnvironment,
      FCM_ENABLED: true,
      FCM_PROJECT_ID: "dica-project",
      FCM_CLIENT_EMAIL: "firebase-admin@example.iam.gserviceaccount.com",
      FCM_PRIVATE_KEY:
        "-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----\\n",
    }).error,
    undefined,
  );
});

test("R2 credentials are required without any public asset URL", () => {
  assert.ok(
    envSchema.validate({ ...validEnvironment, R2_SECRET_ACCESS_KEY: "" }).error,
  );
  assert.equal("R2_PUBLIC_BASE_URL" in validEnvironment, false);
  assert.equal(envSchema.validate(validEnvironment).error, undefined);
});

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(fullPath) : [fullPath];
  });
}
