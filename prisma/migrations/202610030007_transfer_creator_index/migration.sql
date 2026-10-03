CREATE INDEX CONCURRENTLY "transfers_created_by_id_created_at_id_idx"
ON "transfers"("created_by_id", "created_at", "id");
