CREATE INDEX CONCURRENTLY "supply_requests_org_creator_created_at_id_idx"
ON "supply_requests"("organization_id", "created_by_id", "created_at", "id");
