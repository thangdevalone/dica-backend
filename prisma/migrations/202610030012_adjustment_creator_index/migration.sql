CREATE INDEX CONCURRENTLY "inventory_adjustments_creator_created_at_id_idx"
ON "inventory_adjustments"("created_by_id", "created_at", "id");
