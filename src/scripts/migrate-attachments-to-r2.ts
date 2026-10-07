import "dotenv/config";
import { ConfigService } from "@nestjs/config";
import { fileTypeFromBuffer } from "file-type";
import { pathToFileURL } from "node:url";
import { R2StorageService } from "../attachments/r2-storage.service.js";
import { PrismaService } from "../database/prisma.service.js";

const BATCH_SIZE = 100;

export async function migrateAttachmentsToR2(
  db: PrismaService,
  storage: R2StorageService,
) {
  let migrated = 0;

  while (true) {
    const attachments = await db.attachment.findMany({
      where: { objectKey: null, content: { not: null } },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
    });
    if (attachments.length === 0) return migrated;

    for (const attachment of attachments) {
      if (!attachment.content) continue;
      const body = Buffer.from(attachment.content);
      const detectedType = await fileTypeFromBuffer(body);
      const extension = detectedType?.ext ?? "bin";
      const contentType = detectedType?.mime ?? attachment.mimeType;
      const objectKey = `attachments/${attachment.organizationId}/${attachment.id}.${extension}`;

      await storage.put(objectKey, body, contentType);
      const result = await db.attachment.updateMany({
        where: { id: attachment.id, objectKey: null },
        data: { objectKey, content: null, mimeType: contentType },
      });
      if (result.count > 0) migrated += 1;
    }
  }
}

async function main() {
  const config = new ConfigService(process.env);
  const db = new PrismaService(config);
  const storage = new R2StorageService(config);
  try {
    await db.$connect();
    const migrated = await migrateAttachmentsToR2(db, storage);
    console.log(`Migrated ${migrated} attachment(s) to R2.`);
  } finally {
    await db.$disconnect();
  }
}

const isMain = Boolean(
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href,
);
if (isMain)
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
