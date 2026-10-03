CREATE INDEX CONCURRENTLY "transfers_org_from_location_created_at_id_idx"
ON "transfers"("organization_id", "from_stock_location_id", "created_at", "id");
