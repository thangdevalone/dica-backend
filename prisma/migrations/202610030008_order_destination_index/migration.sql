CREATE INDEX CONCURRENTLY "orders_org_destination_created_at_id_idx"
ON "fulfillment_orders"("organization_id", "destination_stock_location_id", "created_at", "id");
