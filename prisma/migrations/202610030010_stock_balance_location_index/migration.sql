CREATE INDEX CONCURRENTLY "stock_balances_location_updated_at_id_idx"
ON "stock_balances"("stock_location_id", "updated_at", "id");
