CREATE INDEX CONCURRENTLY "recipe_versions_mapping_location_effective_from_idx"
ON "recipe_versions"("mapping_id", "stock_location_id", "effective_from");
