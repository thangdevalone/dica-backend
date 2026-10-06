ALTER TABLE "item_eligibilities"
ADD COLUMN "max_quantity_per_request" DECIMAL(20,3);

ALTER TABLE "transfers"
ADD COLUMN "expected_arrival_at" TIMESTAMP(3);
