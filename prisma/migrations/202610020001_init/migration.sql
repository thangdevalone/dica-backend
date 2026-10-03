-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserKind" AS ENUM ('INTERNAL', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "FacilityType" AS ENUM ('CENTRAL_WAREHOUSE', 'CENTRAL_KITCHEN', 'BRANCH');

-- CreateEnum
CREATE TYPE "StockLocationType" AS ENUM ('PHYSICAL', 'IN_TRANSIT');

-- CreateEnum
CREATE TYPE "DepartmentType" AS ENUM ('KITCHEN', 'TABLE', 'WAREHOUSE', 'INVENTORY', 'OTHER');

-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('ORGANIZATION', 'FACILITY', 'STOCK_LOCATION', 'DEPARTMENT', 'OWN', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('STOCK', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'RELEASED', 'PARTIAL', 'COMPLETED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderSourceType" AS ENUM ('STOCK', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED', 'AUTO_APPROVED');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('DRAFT', 'POSTED', 'PENDING_EXCESS_REVIEW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DiscrepancyType" AS ENUM ('SHORTAGE', 'EXCESS', 'DAMAGED');

-- CreateEnum
CREATE TYPE "DiscrepancyStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('DISPATCH_OUT', 'TRANSIT_IN', 'TRANSIT_OUT', 'RECEIPT_IN', 'SUPPLIER_RECEIPT_IN', 'ADJUSTMENT', 'DAMAGE', 'REVERSAL');

-- CreateEnum
CREATE TYPE "AdjustmentStatus" AS ENUM ('DRAFT', 'APPROVED', 'POSTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StocktakeStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REOPENED');

-- CreateEnum
CREATE TYPE "DamageStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalesImportStatus" AS ENUM ('DRAFT', 'VALIDATED', 'DATA_INCOMPLETE', 'COMMITTED', 'FAILED');

-- CreateEnum
CREATE TYPE "VarianceDataStatus" AS ENUM ('COMPLETE', 'DATA_INCOMPLETE');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" "FacilityType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_locations" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" "StockLocationType" NOT NULL DEFAULT 'PHYSICAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "stock_location_id" UUID,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" "DepartmentType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "supplier_id" UUID,
    "kind" "UserKind" NOT NULL DEFAULT 'INTERNAL',
    "username" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "code" VARCHAR(100) NOT NULL,
    "description" VARCHAR(250) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_code" VARCHAR(100) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_code")
);

-- CreateTable
CREATE TABLE "role_grants" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "scope_type" "ScopeType" NOT NULL,
    "facility_id" UUID,
    "stock_location_id" UUID,
    "department_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "role_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_groups" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ingredient_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "decimal_scale" INTEGER NOT NULL DEFAULT 3,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "group_id" UUID,
    "base_unit_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_unit_conversions" (
    "id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "factor_to_base" DECIMAL(20,6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),

    CONSTRAINT "ingredient_unit_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(30),
    "email" VARCHAR(200),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_ingredients" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "supplier_sku" VARCHAR(100),
    "reference_price" DECIMAL(20,4),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "supplier_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_eligibilities" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "item_eligibilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_rules" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "source_type" "SourceType" NOT NULL,
    "source_stock_location_id" UUID,
    "supplier_id" UUID,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_rule_revisions" (
    "id" UUID NOT NULL,
    "source_rule_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_rule_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "required_date" DATE NOT NULL,
    "note" VARCHAR(1000),
    "version" INTEGER NOT NULL DEFAULT 1,
    "submitted_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supply_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "from_stock_location_id" UUID NOT NULL,
    "to_stock_location_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "note" VARCHAR(1000),
    "submitted_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_lines" (
    "id" UUID NOT NULL,
    "transfer_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "quantity" DECIMAL(20,3) NOT NULL,
    "ingredient_name_snapshot" VARCHAR(200) NOT NULL,
    "unit_code_snapshot" VARCHAR(30) NOT NULL,

    CONSTRAINT "transfer_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_approval_events" (
    "id" UUID NOT NULL,
    "transfer_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "policy" VARCHAR(100) NOT NULL,
    "note" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_approval_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_lines" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "requested_unit_id" UUID NOT NULL,
    "requested_quantity" DECIMAL(20,3) NOT NULL,
    "base_quantity" DECIMAL(20,3) NOT NULL,
    "ingredient_name_snapshot" VARCHAR(200) NOT NULL,
    "unit_code_snapshot" VARCHAR(30) NOT NULL,
    "conversion_factor_snapshot" DECIMAL(20,6) NOT NULL,
    "source_type_snapshot" "SourceType",
    "source_rule_revision" INTEGER,
    "source_stock_location_id" UUID,
    "supplier_id" UUID,

    CONSTRAINT "request_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_events" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "policy" VARCHAR(100) NOT NULL,
    "note" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment_orders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "request_id" UUID,
    "transfer_id" UUID,
    "code" VARCHAR(50) NOT NULL,
    "source_type" "OrderSourceType" NOT NULL,
    "source_stock_location_id" UUID,
    "supplier_id" UUID,
    "destination_stock_location_id" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'RELEASED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "released_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fulfillment_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment_lines" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "request_line_id" UUID,
    "transfer_line_id" UUID,
    "ingredient_id" UUID NOT NULL,
    "approved_quantity" DECIMAL(20,3) NOT NULL,
    "dispatched_quantity" DECIMAL(20,3) NOT NULL DEFAULT 0,
    "received_quantity" DECIMAL(20,3) NOT NULL DEFAULT 0,
    "accepted_excess_quantity" DECIMAL(20,3) NOT NULL DEFAULT 0,
    "closed_remaining_quantity" DECIMAL(20,3) NOT NULL DEFAULT 0,
    "unit_code_snapshot" VARCHAR(30) NOT NULL,
    "unit_price_snapshot" DECIMAL(20,4),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "fulfillment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatches" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "status" "DispatchStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "posted_by_id" UUID,
    "posted_at" TIMESTAMP(3),
    "note" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_lines" (
    "id" UUID NOT NULL,
    "dispatch_id" UUID NOT NULL,
    "order_line_id" UUID NOT NULL,
    "quantity" DECIMAL(20,3) NOT NULL,

    CONSTRAINT "dispatch_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "dispatch_id" UUID,
    "code" VARCHAR(50) NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "posted_by_id" UUID,
    "posted_at" TIMESTAMP(3),
    "note" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_lines" (
    "id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "order_line_id" UUID NOT NULL,
    "reported_quantity" DECIMAL(20,3) NOT NULL,
    "accepted_quantity" DECIMAL(20,3) NOT NULL DEFAULT 0,
    "excess_quantity" DECIMAL(20,3) NOT NULL DEFAULT 0,
    "note" VARCHAR(1000),

    CONSTRAINT "receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discrepancy_cases" (
    "id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "receipt_line_id" UUID NOT NULL,
    "type" "DiscrepancyType" NOT NULL,
    "status" "DiscrepancyStatus" NOT NULL DEFAULT 'OPEN',
    "expected_quantity" DECIMAL(20,3) NOT NULL,
    "actual_quantity" DECIMAL(20,3) NOT NULL,
    "resolution" VARCHAR(1000),
    "resolved_by_id" UUID,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discrepancy_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_balances" (
    "id" UUID NOT NULL,
    "stock_location_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "quantity" DECIMAL(20,3) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_ledger_entries" (
    "id" UUID NOT NULL,
    "stock_location_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "entry_type" "LedgerEntryType" NOT NULL,
    "quantity" DECIMAL(20,3) NOT NULL,
    "source_type" VARCHAR(50) NOT NULL,
    "source_id" UUID NOT NULL,
    "source_line_id" UUID NOT NULL,
    "posting_key" VARCHAR(250) NOT NULL,
    "reversal_of_id" UUID,
    "posted_by_id" UUID NOT NULL,
    "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_adjustments" (
    "id" UUID NOT NULL,
    "stock_location_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "quantity" DECIMAL(20,3) NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "source_type" VARCHAR(50),
    "source_id" UUID,
    "status" "AdjustmentStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(3),
    "posted_by_id" UUID,
    "posted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stocktakes" (
    "id" UUID NOT NULL,
    "stock_location_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "cutoff_at" TIMESTAMP(3) NOT NULL,
    "status" "StocktakeStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),

    CONSTRAINT "stocktakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stocktake_lines" (
    "id" UUID NOT NULL,
    "stocktake_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "counted_quantity" DECIMAL(20,3) NOT NULL,
    "expected_quantity_snapshot" DECIMAL(20,3),
    "variance_quantity" DECIMAL(20,3),
    "counted_by_id" UUID NOT NULL,
    "counted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stocktake_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "damage_reports" (
    "id" UUID NOT NULL,
    "stock_location_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "status" "DamageStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "reason" VARCHAR(1000) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "confirmed_by_id" UUID,
    "confirmed_at" TIMESTAMP(3),

    CONSTRAINT "damage_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "damage_lines" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "quantity" DECIMAL(20,3) NOT NULL,
    "unit_code" VARCHAR(30) NOT NULL,
    "reason" VARCHAR(1000),

    CONSTRAINT "damage_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_mappings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "external_item_key" VARCHAR(150) NOT NULL,
    "menu_item_name" VARCHAR(250) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "menu_item_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_versions" (
    "id" UUID NOT NULL,
    "mapping_id" UUID NOT NULL,
    "stock_location_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" UUID NOT NULL,
    "recipe_version_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "base_quantity" DECIMAL(20,6) NOT NULL,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_import_batches" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "external_key" VARCHAR(150) NOT NULL,
    "status" "SalesImportStatus" NOT NULL DEFAULT 'DRAFT',
    "error_summary" JSONB,
    "created_by_id" UUID NOT NULL,
    "committed_by_id" UUID,
    "committed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "mapping_id" UUID,
    "source" VARCHAR(50) NOT NULL,
    "external_key" VARCHAR(150) NOT NULL,
    "external_item_key" VARCHAR(150) NOT NULL,
    "sold_at" TIMESTAMP(3) NOT NULL,
    "quantity" DECIMAL(20,3) NOT NULL,
    "validation_error" VARCHAR(1000),

    CONSTRAINT "sales_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variance_results" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "stocktake_id" UUID NOT NULL,
    "stock_location_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "data_status" "VarianceDataStatus" NOT NULL,
    "opening_stock_snapshot" DECIMAL(20,3),
    "posted_movement_snapshot" DECIMAL(20,3),
    "expected_usage_snapshot" DECIMAL(20,3),
    "expected_closing_snapshot" DECIMAL(20,3),
    "actual_closing_snapshot" DECIMAL(20,3) NOT NULL,
    "variance_quantity" DECIMAL(20,3),
    "variance_rate" DECIMAL(12,4),
    "missing_data" JSONB,
    "calculated_by_id" UUID NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variance_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "facility_id" UUID,
    "ingredient_id" UUID,
    "threshold_type" VARCHAR(30) NOT NULL,
    "threshold_value" DECIMAL(20,4) NOT NULL,
    "test_only" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_tracking" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "reconciled_value" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "paid_value" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by_id" UUID NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "operation" VARCHAR(100) NOT NULL,
    "key" VARCHAR(150) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(100) NOT NULL,
    "resource_id" VARCHAR(100) NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "request_id" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(250) NOT NULL,
    "message" VARCHAR(1000) NOT NULL,
    "resource_type" VARCHAR(100) NOT NULL,
    "resource_id" VARCHAR(100) NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "aggregate_type" VARCHAR(100) NOT NULL,
    "aggregate_id" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "last_error" VARCHAR(2000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");

-- CreateIndex
CREATE INDEX "facilities_organization_id_active_idx" ON "facilities"("organization_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "facilities_organization_id_code_key" ON "facilities"("organization_id", "code");

-- CreateIndex
CREATE INDEX "stock_locations_facility_id_active_idx" ON "stock_locations"("facility_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "stock_locations_facility_id_code_key" ON "stock_locations"("facility_id", "code");

-- CreateIndex
CREATE INDEX "departments_stock_location_id_idx" ON "departments"("stock_location_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_facility_id_code_key" ON "departments"("facility_id", "code");

-- CreateIndex
CREATE INDEX "users_supplier_id_idx" ON "users"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_organization_id_username_key" ON "users"("organization_id", "username");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "roles_organization_id_code_key" ON "roles"("organization_id", "code");

-- CreateIndex
CREATE INDEX "role_grants_user_id_revoked_at_idx" ON "role_grants"("user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_groups_organization_id_code_key" ON "ingredient_groups"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "units_organization_id_code_key" ON "units"("organization_id", "code");

-- CreateIndex
CREATE INDEX "ingredients_organization_id_active_idx" ON "ingredients"("organization_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_organization_id_code_key" ON "ingredients"("organization_id", "code");

-- CreateIndex
CREATE INDEX "ingredient_unit_conversions_ingredient_id_effective_from_ef_idx" ON "ingredient_unit_conversions"("ingredient_id", "effective_from", "effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_unit_conversions_ingredient_id_unit_id_version_key" ON "ingredient_unit_conversions"("ingredient_id", "unit_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_organization_id_code_key" ON "suppliers"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_ingredients_supplier_id_ingredient_id_key" ON "supplier_ingredients"("supplier_id", "ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_eligibilities_facility_id_department_id_ingredient_id_key" ON "item_eligibilities"("facility_id", "department_id", "ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "source_rules_facility_id_ingredient_id_key" ON "source_rules"("facility_id", "ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "source_rule_revisions_source_rule_id_revision_key" ON "source_rule_revisions"("source_rule_id", "revision");

-- CreateIndex
CREATE INDEX "supply_requests_organization_id_facility_id_status_idx" ON "supply_requests"("organization_id", "facility_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "supply_requests_organization_id_code_key" ON "supply_requests"("organization_id", "code");

-- CreateIndex
CREATE INDEX "transfers_organization_id_status_idx" ON "transfers"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "transfers_organization_id_code_key" ON "transfers"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_lines_transfer_id_ingredient_id_key" ON "transfer_lines"("transfer_id", "ingredient_id");

-- CreateIndex
CREATE INDEX "transfer_approval_events_transfer_id_created_at_idx" ON "transfer_approval_events"("transfer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "request_lines_request_id_ingredient_id_key" ON "request_lines"("request_id", "ingredient_id");

-- CreateIndex
CREATE INDEX "approval_events_request_id_created_at_idx" ON "approval_events"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "fulfillment_orders_organization_id_status_idx" ON "fulfillment_orders"("organization_id", "status");

-- CreateIndex
CREATE INDEX "fulfillment_orders_supplier_id_status_idx" ON "fulfillment_orders"("supplier_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_orders_organization_id_code_key" ON "fulfillment_orders"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_lines_order_id_request_line_id_key" ON "fulfillment_lines"("order_id", "request_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_lines_order_id_transfer_line_id_key" ON "fulfillment_lines"("order_id", "transfer_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "dispatches_code_key" ON "dispatches"("code");

-- CreateIndex
CREATE INDEX "dispatches_order_id_status_idx" ON "dispatches"("order_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "dispatch_lines_dispatch_id_order_line_id_key" ON "dispatch_lines"("dispatch_id", "order_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_code_key" ON "receipts"("code");

-- CreateIndex
CREATE INDEX "receipts_order_id_status_idx" ON "receipts"("order_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_lines_receipt_id_order_line_id_key" ON "receipt_lines"("receipt_id", "order_line_id");

-- CreateIndex
CREATE INDEX "discrepancy_cases_status_created_at_idx" ON "discrepancy_cases"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "stock_balances_stock_location_id_ingredient_id_key" ON "stock_balances"("stock_location_id", "ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_ledger_entries_posting_key_key" ON "stock_ledger_entries"("posting_key");

-- CreateIndex
CREATE INDEX "stock_ledger_entries_stock_location_id_ingredient_id_posted_idx" ON "stock_ledger_entries"("stock_location_id", "ingredient_id", "posted_at");

-- CreateIndex
CREATE INDEX "inventory_adjustments_stock_location_id_status_idx" ON "inventory_adjustments"("stock_location_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "stocktakes_stock_location_id_business_date_version_key" ON "stocktakes"("stock_location_id", "business_date", "version");

-- CreateIndex
CREATE UNIQUE INDEX "stocktake_lines_stocktake_id_ingredient_id_key" ON "stocktake_lines"("stocktake_id", "ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "damage_reports_code_key" ON "damage_reports"("code");

-- CreateIndex
CREATE INDEX "damage_reports_stock_location_id_status_idx" ON "damage_reports"("stock_location_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "damage_lines_report_id_ingredient_id_key" ON "damage_lines"("report_id", "ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_mappings_organization_id_facility_id_source_exter_key" ON "menu_item_mappings"("organization_id", "facility_id", "source", "external_item_key");

-- CreateIndex
CREATE INDEX "recipe_versions_mapping_id_effective_from_effective_to_idx" ON "recipe_versions"("mapping_id", "effective_from", "effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_versions_mapping_id_version_key" ON "recipe_versions"("mapping_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_ingredients_recipe_version_id_ingredient_id_key" ON "recipe_ingredients"("recipe_version_id", "ingredient_id");

-- CreateIndex
CREATE INDEX "sales_import_batches_organization_id_facility_id_status_idx" ON "sales_import_batches"("organization_id", "facility_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sales_import_batches_organization_id_source_external_key_key" ON "sales_import_batches"("organization_id", "source", "external_key");

-- CreateIndex
CREATE INDEX "sales_records_organization_id_sold_at_idx" ON "sales_records"("organization_id", "sold_at");

-- CreateIndex
CREATE UNIQUE INDEX "sales_records_organization_id_source_external_key_key" ON "sales_records"("organization_id", "source", "external_key");

-- CreateIndex
CREATE INDEX "variance_results_organization_id_stock_location_id_calculat_idx" ON "variance_results"("organization_id", "stock_location_id", "calculated_at");

-- CreateIndex
CREATE UNIQUE INDEX "variance_results_stocktake_id_ingredient_id_version_key" ON "variance_results"("stocktake_id", "ingredient_id", "version");

-- CreateIndex
CREATE INDEX "alert_rules_organization_id_facility_id_ingredient_id_idx" ON "alert_rules"("organization_id", "facility_id", "ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_tracking_order_id_key" ON "payment_tracking"("order_id");

-- CreateIndex
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_organization_id_user_id_operation_key_key" ON "idempotency_records"("organization_id", "user_id", "operation", "key");

-- CreateIndex
CREATE INDEX "audit_events_organization_id_resource_type_resource_id_idx" ON "audit_events"("organization_id", "resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_events_request_id_idx" ON "audit_events"("request_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_status_created_at_idx" ON "notifications"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- AddForeignKey
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_stock_location_id_fkey" FOREIGN KEY ("stock_location_id") REFERENCES "stock_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_code_fkey" FOREIGN KEY ("permission_code") REFERENCES "permissions"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_grants" ADD CONSTRAINT "role_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_grants" ADD CONSTRAINT "role_grants_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_grants" ADD CONSTRAINT "role_grants_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_grants" ADD CONSTRAINT "role_grants_stock_location_id_fkey" FOREIGN KEY ("stock_location_id") REFERENCES "stock_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_grants" ADD CONSTRAINT "role_grants_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_groups" ADD CONSTRAINT "ingredient_groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "ingredient_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_base_unit_id_fkey" FOREIGN KEY ("base_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_unit_conversions" ADD CONSTRAINT "ingredient_unit_conversions_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_unit_conversions" ADD CONSTRAINT "ingredient_unit_conversions_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_ingredients" ADD CONSTRAINT "supplier_ingredients_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_ingredients" ADD CONSTRAINT "supplier_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_eligibilities" ADD CONSTRAINT "item_eligibilities_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_eligibilities" ADD CONSTRAINT "item_eligibilities_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_eligibilities" ADD CONSTRAINT "item_eligibilities_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_rules" ADD CONSTRAINT "source_rules_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_rules" ADD CONSTRAINT "source_rules_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_rules" ADD CONSTRAINT "source_rules_source_stock_location_id_fkey" FOREIGN KEY ("source_stock_location_id") REFERENCES "stock_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_rules" ADD CONSTRAINT "source_rules_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_rule_revisions" ADD CONSTRAINT "source_rule_revisions_source_rule_id_fkey" FOREIGN KEY ("source_rule_id") REFERENCES "source_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_requests" ADD CONSTRAINT "supply_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_requests" ADD CONSTRAINT "supply_requests_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_requests" ADD CONSTRAINT "supply_requests_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_requests" ADD CONSTRAINT "supply_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_stock_location_id_fkey" FOREIGN KEY ("from_stock_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_stock_location_id_fkey" FOREIGN KEY ("to_stock_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_lines" ADD CONSTRAINT "transfer_lines_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_lines" ADD CONSTRAINT "transfer_lines_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_approval_events" ADD CONSTRAINT "transfer_approval_events_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_lines" ADD CONSTRAINT "request_lines_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "supply_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_lines" ADD CONSTRAINT "request_lines_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "supply_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_orders" ADD CONSTRAINT "fulfillment_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_orders" ADD CONSTRAINT "fulfillment_orders_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "supply_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_orders" ADD CONSTRAINT "fulfillment_orders_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_orders" ADD CONSTRAINT "fulfillment_orders_source_stock_location_id_fkey" FOREIGN KEY ("source_stock_location_id") REFERENCES "stock_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_orders" ADD CONSTRAINT "fulfillment_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_orders" ADD CONSTRAINT "fulfillment_orders_destination_stock_location_id_fkey" FOREIGN KEY ("destination_stock_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_lines" ADD CONSTRAINT "fulfillment_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "fulfillment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_lines" ADD CONSTRAINT "fulfillment_lines_request_line_id_fkey" FOREIGN KEY ("request_line_id") REFERENCES "request_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_lines" ADD CONSTRAINT "fulfillment_lines_transfer_line_id_fkey" FOREIGN KEY ("transfer_line_id") REFERENCES "transfer_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_lines" ADD CONSTRAINT "fulfillment_lines_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "fulfillment_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_lines" ADD CONSTRAINT "dispatch_lines_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "dispatches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_lines" ADD CONSTRAINT "dispatch_lines_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "fulfillment_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "fulfillment_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "dispatches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_lines" ADD CONSTRAINT "receipt_lines_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_lines" ADD CONSTRAINT "receipt_lines_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "fulfillment_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discrepancy_cases" ADD CONSTRAINT "discrepancy_cases_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discrepancy_cases" ADD CONSTRAINT "discrepancy_cases_receipt_line_id_fkey" FOREIGN KEY ("receipt_line_id") REFERENCES "receipt_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_stock_location_id_fkey" FOREIGN KEY ("stock_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger_entries" ADD CONSTRAINT "stock_ledger_entries_stock_location_id_fkey" FOREIGN KEY ("stock_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger_entries" ADD CONSTRAINT "stock_ledger_entries_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_stock_location_id_fkey" FOREIGN KEY ("stock_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocktakes" ADD CONSTRAINT "stocktakes_stock_location_id_fkey" FOREIGN KEY ("stock_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocktake_lines" ADD CONSTRAINT "stocktake_lines_stocktake_id_fkey" FOREIGN KEY ("stocktake_id") REFERENCES "stocktakes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocktake_lines" ADD CONSTRAINT "stocktake_lines_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_stock_location_id_fkey" FOREIGN KEY ("stock_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damage_lines" ADD CONSTRAINT "damage_lines_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "damage_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damage_lines" ADD CONSTRAINT "damage_lines_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_mappings" ADD CONSTRAINT "menu_item_mappings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_mappings" ADD CONSTRAINT "menu_item_mappings_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_versions" ADD CONSTRAINT "recipe_versions_mapping_id_fkey" FOREIGN KEY ("mapping_id") REFERENCES "menu_item_mappings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_versions" ADD CONSTRAINT "recipe_versions_stock_location_id_fkey" FOREIGN KEY ("stock_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_version_id_fkey" FOREIGN KEY ("recipe_version_id") REFERENCES "recipe_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_import_batches" ADD CONSTRAINT "sales_import_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_import_batches" ADD CONSTRAINT "sales_import_batches_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_records" ADD CONSTRAINT "sales_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_records" ADD CONSTRAINT "sales_records_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "sales_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_records" ADD CONSTRAINT "sales_records_mapping_id_fkey" FOREIGN KEY ("mapping_id") REFERENCES "menu_item_mappings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variance_results" ADD CONSTRAINT "variance_results_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variance_results" ADD CONSTRAINT "variance_results_stocktake_id_fkey" FOREIGN KEY ("stocktake_id") REFERENCES "stocktakes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variance_results" ADD CONSTRAINT "variance_results_stock_location_id_fkey" FOREIGN KEY ("stock_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variance_results" ADD CONSTRAINT "variance_results_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_tracking" ADD CONSTRAINT "payment_tracking_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "fulfillment_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
