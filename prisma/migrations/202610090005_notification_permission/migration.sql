ALTER TABLE "notifications" ADD COLUMN "required_permission" VARCHAR(100);

-- Existing price alerts also contain monetary data. Preserve current-scope
-- checks after the recipient loses the permission that granted the alert.
UPDATE "notifications"
SET "required_permission" = 'price_alert.read'
WHERE "title" IN ('Đơn giá vượt ngưỡng', 'Giá nhà cung cấp vượt ngưỡng')
  AND "resource_type" IN ('FulfillmentOrder', 'Supplier');
