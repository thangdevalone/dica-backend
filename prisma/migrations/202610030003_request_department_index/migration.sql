CREATE INDEX CONCURRENTLY "supply_requests_org_department_created_at_id_idx"
ON "supply_requests"("organization_id", "department_id", "created_at", "id");
