CREATE INDEX CONCURRENTLY "stocktakes_creator_created_at_id_idx"
ON "stocktakes"("created_by_id", "created_at", "id");
