ALTER TABLE "attachments"
  ADD COLUMN "object_key" VARCHAR(512),
  ADD COLUMN "upload_status" VARCHAR(20) NOT NULL DEFAULT 'READY',
  ADD COLUMN "upload_expires_at" TIMESTAMP(3),
  ALTER COLUMN "content" DROP NOT NULL;

CREATE UNIQUE INDEX "attachments_object_key_key"
  ON "attachments"("object_key");

ALTER TABLE "attachments"
  ADD CONSTRAINT "attachments_storage_check"
  CHECK ("object_key" IS NOT NULL OR "content" IS NOT NULL),
  ADD CONSTRAINT "attachments_upload_status_check"
  CHECK ("upload_status" IN ('PENDING', 'READY'));

CREATE INDEX "attachments_organization_id_upload_status_upload_expires_at_idx"
  ON "attachments"("organization_id", "upload_status", "upload_expires_at");
