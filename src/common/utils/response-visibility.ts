import { Prisma } from "../../generated/prisma/client.js";
import type { AuthUser } from "../../auth/auth.types.js";
import { ScopeService, type ResourceScope } from "../../auth/scope.service.js";

const prices = new Set([
  "unitPriceSnapshot",
  "referencePrice",
  "basePrice",
  "reconciledValue",
  "paidValue",
  "pendingPaidValue",
  "estimated_value",
  "in_transit_value",
  "stock_value",
  "value",
  "paid_value",
  "pending_paid_value",
  "reconciled_value",
  "unit_price",
  "reference_price",
  "base_price",
  "total_value",
]);
const variances = new Set([
  "expectedQuantitySnapshot",
  "varianceQuantity",
  "varianceRate",
  "expectedClosingSnapshot",
  "openingStockSnapshot",
  "postedMovementSnapshot",
  "expectedUsageSnapshot",
  "expected",
  "variance",
]);

export function visibleResponse(
  value: unknown,
  user: AuthUser,
  supplierOrders = false,
  inherited: ResourceScope = {},
): unknown {
  if (Array.isArray(value))
    return value.map((item) =>
      visibleResponse(item, user, supplierOrders, inherited),
    );
  if (
    !value ||
    typeof value !== "object" ||
    value instanceof Date ||
    Prisma.Decimal.isDecimal(value)
  )
    return value;
  const row = value as Record<string, unknown>;
  const order = row.order as Record<string, unknown> | undefined;
  const location = (row.stockLocation ??
    row.destinationStockLocation ??
    order?.destinationStockLocation) as Record<string, unknown> | undefined;
  const context: ResourceScope = {
    ...inherited,
    ...(typeof order?.destinationStockLocationId === "string"
      ? { stockLocationId: order.destinationStockLocationId }
      : {}),
    ...(typeof row.facilityId === "string"
      ? { facilityId: row.facilityId }
      : {}),
    ...(typeof row.departmentId === "string"
      ? { departmentId: row.departmentId }
      : {}),
    ...(typeof row.stockLocationId === "string"
      ? { stockLocationId: row.stockLocationId }
      : {}),
    ...(typeof row.destinationStockLocationId === "string"
      ? { stockLocationId: row.destinationStockLocationId }
      : {}),
    ...(typeof row.createdById === "string"
      ? { createdById: row.createdById }
      : {}),
    ...(location && typeof location.facilityId === "string"
      ? { facilityId: location.facilityId }
      : {}),
  };
  const scope = new ScopeService();
  const canPrice =
    (supplierOrders && user.kind === "SUPPLIER") ||
    scope.canAccess(user, "price.read", context) ||
    scope.canAccess(user, "price_rule.manage", context);
  const canVariance = scope.canAccess(user, "variance.read", context);
  return Object.fromEntries(
    Object.entries(row)
      .filter(
        ([key]) =>
          (!prices.has(key) || canPrice) &&
          (!variances.has(key) || canVariance),
      )
      .map(([key, item]) => [
        key,
        visibleResponse(item, user, supplierOrders, context),
      ]),
  );
}
