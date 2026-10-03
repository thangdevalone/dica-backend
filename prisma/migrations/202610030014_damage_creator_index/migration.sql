CREATE INDEX CONCURRENTLY "damage_reports_creator_created_at_id_idx"
ON "damage_reports"("created_by_id", "created_at", "id");
