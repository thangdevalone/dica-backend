-- Một câu lệnh/migration để Prisma không bọc nhiều CREATE INDEX CONCURRENTLY
-- vào cùng transaction PostgreSQL.
CREATE INDEX CONCURRENTLY "source_rules_facility_id_effective_from_id_idx"
ON "source_rules"("facility_id", "effective_from", "id");
