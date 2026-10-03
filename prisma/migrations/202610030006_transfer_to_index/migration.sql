CREATE INDEX CONCURRENTLY "transfers_org_to_location_created_at_id_idx"
ON "transfers"("organization_id", "to_stock_location_id", "created_at", "id");
