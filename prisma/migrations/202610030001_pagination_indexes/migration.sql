CREATE INDEX "users_organization_id_created_at_id_idx"
ON "users"("organization_id", "created_at", "id");

CREATE INDEX "supply_requests_organization_id_created_at_id_idx"
ON "supply_requests"("organization_id", "created_at", "id");

CREATE INDEX "transfers_organization_id_created_at_id_idx"
ON "transfers"("organization_id", "created_at", "id");

CREATE INDEX "fulfillment_orders_organization_id_created_at_id_idx"
ON "fulfillment_orders"("organization_id", "created_at", "id");

CREATE INDEX "fulfillment_orders_supplier_id_released_at_id_idx"
ON "fulfillment_orders"("supplier_id", "released_at", "id");

CREATE INDEX "discrepancy_cases_created_at_id_idx"
ON "discrepancy_cases"("created_at", "id");

CREATE INDEX "stock_balances_updated_at_id_idx"
ON "stock_balances"("updated_at", "id");

CREATE INDEX "stock_ledger_entries_posted_at_id_idx"
ON "stock_ledger_entries"("posted_at", "id");

CREATE INDEX "inventory_adjustments_stock_location_id_created_at_id_idx"
ON "inventory_adjustments"("stock_location_id", "created_at", "id");

CREATE INDEX "stocktakes_stock_location_id_created_at_id_idx"
ON "stocktakes"("stock_location_id", "created_at", "id");

CREATE INDEX "damage_reports_stock_location_id_created_at_id_idx"
ON "damage_reports"("stock_location_id", "created_at", "id");

CREATE INDEX "menu_item_mappings_org_facility_name_id_idx"
ON "menu_item_mappings"("organization_id", "facility_id", "menu_item_name", "id");

CREATE INDEX "recipe_versions_mapping_id_effective_from_id_idx"
ON "recipe_versions"("mapping_id", "effective_from", "id");

CREATE INDEX "variance_results_organization_id_calculated_at_id_idx"
ON "variance_results"("organization_id", "calculated_at", "id");

CREATE INDEX "alert_rules_organization_id_id_idx"
ON "alert_rules"("organization_id", "id");

CREATE INDEX "payment_tracking_updated_at_id_idx"
ON "payment_tracking"("updated_at", "id");

CREATE INDEX "audit_events_organization_id_created_at_id_idx"
ON "audit_events"("organization_id", "created_at", "id");

CREATE INDEX "notifications_user_id_created_at_id_idx"
ON "notifications"("user_id", "created_at", "id");
