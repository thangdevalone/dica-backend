CREATE TABLE "attachments" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "uploaded_by_id" UUID NOT NULL,
  "resource_type" VARCHAR(30) NOT NULL,
  "resource_id" UUID NOT NULL,
  "file_name" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(100) NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "content" BYTEA NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attachments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "attachments_organization_id_resource_type_resource_id_created_at_idx"
  ON "attachments"("organization_id", "resource_type", "resource_id", "created_at");
