import assert from "node:assert/strict";
import test from "node:test";
import { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../src/database/prisma.service.js";
import type { PushService } from "../src/push/push.service.js";
import type { R2StorageService } from "../src/attachments/r2-storage.service.js";
import { WorkflowWorker } from "../src/workflow/workflow.worker.js";

test("worker logs failed step and stack, continues other steps and can retry", async () => {
  const worker = new WorkflowWorker(
    {} as PrismaService,
    new ConfigService({ NODE_ENV: "test" }),
    {} as PushService,
    {} as R2StorageService,
  );
  const error = new Error("Missing database column");
  const logs: unknown[][] = [];
  const steps: string[] = [];
  Object.assign(worker, {
    logger: { error: (...args: unknown[]) => logs.push(args) },
    closeShortages: async () => {
      steps.push("close");
      throw error;
    },
    settleReturns: async () => {
      steps.push("returns");
    },
    dueNotifications: async () => {
      steps.push("due");
    },
    remind: async () => {
      steps.push("remind");
    },
    expireImages: async () => {
      steps.push("expire");
    },
  });
  await worker.tick();
  await worker.tick();
  assert.deepEqual(steps, [
    "close",
    "returns",
    "due",
    "remind",
    "expire",
    "close",
    "returns",
    "due",
    "remind",
    "expire",
  ]);
  assert.equal(logs.length, 2);
  assert.match(String(logs[0]?.[0]), /closeShortages/);
  assert.equal(logs[0]?.[1], error.stack);
});
