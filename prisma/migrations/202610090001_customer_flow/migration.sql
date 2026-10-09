-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "attachment_retention_months" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "payment_approval_required" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "transfers" ADD COLUMN     "expected_arrival_end_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "fulfillment_orders" ADD COLUMN     "payment_due_at" TIMESTAMP(3),
ADD COLUMN     "shortage_deadline_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "fulfillment_lines" ADD COLUMN     "returned_quantity" DECIMAL(20,3) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payment_tracking" ADD COLUMN     "confirmed_by_id" UUID,
ADD COLUMN     "pending_paid_value" DECIMAL(20,4);

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "last_reminded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "price_rules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "base_price" DECIMAL(20,4) NOT NULL,
    "tolerance_percent" DECIMAL(10,4) NOT NULL DEFAULT 10,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_documents" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "note" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "settle_at" TIMESTAMP(3),
    "posted_at" TIMESTAMP(3),

    CONSTRAINT "return_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_lines" (
    "id" UUID NOT NULL,
    "return_id" UUID NOT NULL,
    "order_line_id" UUID NOT NULL,
    "quantity" DECIMAL(20,3) NOT NULL,

    CONSTRAINT "return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "price_rules_organization_id_ingredient_id_key" ON "price_rules"("organization_id", "ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "return_documents_code_key" ON "return_documents"("code");

-- CreateIndex
CREATE INDEX "return_documents_status_settle_at_idx" ON "return_documents"("status", "settle_at");

-- CreateIndex
CREATE UNIQUE INDEX "return_lines_return_id_order_line_id_key" ON "return_lines"("return_id", "order_line_id");

-- AddForeignKey
ALTER TABLE "return_documents" ADD CONSTRAINT "return_documents_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "fulfillment_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_lines" ADD CONSTRAINT "return_lines_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "return_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_lines" ADD CONSTRAINT "return_lines_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "fulfillment_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "notifications_unread_reminder_idx" ON "notifications" ("last_reminded_at") WHERE "status" = 'UNREAD';
UPDATE "fulfillment_orders" AS o SET "shortage_deadline_at" = (((r."required_date"::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'UTC') FROM "supply_requests" r WHERE o."request_id" = r."id";
UPDATE "fulfillment_orders" AS o SET "shortage_deadline_at" =
  (((((COALESCE(t."expected_arrival_at", t."created_at") AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'UTC')
FROM "transfers" t WHERE o."transfer_id" = t."id" AND o."shortage_deadline_at" IS NULL;
