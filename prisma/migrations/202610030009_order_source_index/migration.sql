CREATE INDEX CONCURRENTLY "orders_org_source_created_at_id_idx"
ON "fulfillment_orders"("organization_id", "source_stock_location_id", "created_at", "id");
