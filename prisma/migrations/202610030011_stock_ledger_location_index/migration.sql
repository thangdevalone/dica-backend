CREATE INDEX CONCURRENTLY "stock_ledger_location_posted_at_id_idx"
ON "stock_ledger_entries"("stock_location_id", "posted_at", "id");
