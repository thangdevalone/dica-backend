import { Injectable } from "@nestjs/common";
import type { AuthUser } from "../auth/auth.types.js";
import { ScopeService, type ResourceScope } from "../auth/scope.service.js";
import { PrismaService } from "../database/prisma.service.js";
import {
  AdjustmentStatus,
  DamageStatus,
  DiscrepancyStatus,
  DispatchStatus,
  DocumentStatus,
  NotificationStatus,
  OrderStatus,
  Prisma,
  ReceiptStatus,
  StockLocationType,
  StocktakeStatus,
} from "../generated/prisma/client.js";
import type { DashboardQueryDto } from "./dashboard.dto.js";
import {
  DASHBOARD_TIME_ZONE,
  dayKey,
  decimalOf,
  percentage,
  periodDayKeys,
  resolveThresholdRule,
  startOfDayKey,
} from "./dashboard.util.js";

const ZERO = new Prisma.Decimal(0);
const LOW_STOCK_LIMIT = 10;
const LIST_LIMIT = 6;

interface LocationRow {
  id: string;
  code: string;
  name: string;
  type: StockLocationType;
  active: boolean;
  facilityId: string;
}

interface FacilityRow {
  id: string;
  code: string;
  name: string;
  type: string;
  active: boolean;
}

interface Context {
  user: AuthUser;
  facilityId: string | undefined;
  days: number;
  keys: string[];
  from: Date;
  locations: LocationRow[];
  facilities: FacilityRow[];
}

interface FacilityStats {
  stock_rows: number;
  stock_value: Prisma.Decimal;
  low_stock: number;
  pending_requests: number;
  open_inbound_orders: number;
}

/**
 * Tổng hợp số liệu cho màn hình tổng quan. Mỗi khối chỉ được tính khi người
 * dùng có quyền đọc tương ứng và luôn bị giới hạn theo scope của grant, nên
 * endpoint chỉ yêu cầu đăng nhập; khối không có quyền trả về `null`.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly db: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  async summary(user: AuthUser, query: DashboardQueryDto) {
    const days = query.days ?? 14;
    const now = new Date();
    const keys = periodDayKeys(now, days);
    const from = startOfDayKey(keys[0]!);
    const [facilities, locations] = await Promise.all([
      this.db.facility.findMany({
        where: { organizationId: user.organizationId },
        select: { id: true, code: true, name: true, type: true, active: true },
        orderBy: [{ code: "asc" }],
      }),
      this.db.stockLocation.findMany({
        where: {
          facility: { organizationId: user.organizationId },
          ...(query.facility_id ? { facilityId: query.facility_id } : {}),
        },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          active: true,
          facilityId: true,
        },
      }),
    ]);
    const ctx: Context = {
      user,
      facilityId: query.facility_id,
      days,
      keys,
      from,
      locations,
      facilities,
    };
    const facilityStats = new Map<string, FacilityStats>();
    const stats = (facilityId: string) => {
      let current = facilityStats.get(facilityId);
      if (!current) {
        current = {
          stock_rows: 0,
          stock_value: ZERO,
          low_stock: 0,
          pending_requests: 0,
          open_inbound_orders: 0,
        };
        facilityStats.set(facilityId, current);
      }
      return current;
    };

    const [
      counts,
      inventory,
      movements,
      requests,
      orders,
      delivery,
      transfers,
      operations,
      notifications,
      recentActivity,
    ] = await Promise.all([
      this.counts(ctx),
      this.inventory(ctx, stats),
      this.movements(ctx),
      this.requests(ctx, stats),
      this.orders(ctx, stats),
      this.delivery(ctx),
      this.transfers(ctx),
      this.operations(ctx),
      this.notifications(ctx),
      this.recentActivity(ctx),
    ]);

    const visibleFacilityIds = this.visibleFacilityIds(ctx);
    const facilitySummaries = visibleFacilityIds
      ? facilities
          .filter((facility) => visibleFacilityIds.has(facility.id))
          .map((facility) => {
            const current = facilityStats.get(facility.id);
            const facilityLocations = locations.filter(
              (location) => location.facilityId === facility.id,
            );
            return {
              id: facility.id,
              code: facility.code,
              name: facility.name,
              type: facility.type,
              active: facility.active,
              stock_locations: facilityLocations.length,
              stock_rows: current?.stock_rows ?? 0,
              stock_value: (current?.stock_value ?? ZERO).toFixed(2),
              low_stock: current?.low_stock ?? 0,
              pending_requests: current?.pending_requests ?? 0,
              open_inbound_orders: current?.open_inbound_orders ?? 0,
            };
          })
      : null;

    return {
      data: {
        generated_at: now.toISOString(),
        time_zone: DASHBOARD_TIME_ZONE,
        period: {
          days,
          from: from.toISOString(),
          to: now.toISOString(),
          keys,
        },
        facility_id: query.facility_id ?? null,
        counts,
        inventory,
        movements,
        requests,
        orders,
        delivery,
        transfers,
        operations,
        notifications,
        recent_activity: recentActivity,
        facilities: facilitySummaries,
      },
      message: "Lấy số liệu tổng quan thành công.",
    };
  }

  // ---------------------------------------------------------------------------
  // Khối số liệu
  // ---------------------------------------------------------------------------

  private async counts(ctx: Context) {
    const { user } = ctx;
    const has = (permission: string) =>
      this.scope.grantsFor(user, permission).length > 0;
    const visibleFacilities = this.visibleFacilityIds(ctx);
    const locationIds = this.locationIds(ctx, "stock_location.read");
    const departmentWhere = this.departmentWhere(ctx);
    const [departments, ingredients, suppliers, users] = await Promise.all([
      departmentWhere
        ? this.db.department.count({ where: departmentWhere })
        : null,
      has("ingredient.read")
        ? this.db.ingredient.count({
            where: { organizationId: user.organizationId, active: true },
          })
        : null,
      has("supplier.read")
        ? this.db.supplier.count({
            where: { organizationId: user.organizationId, active: true },
          })
        : null,
      has("user.read")
        ? this.db.user.count({
            where: { organizationId: user.organizationId, active: true },
          })
        : null,
    ]);
    return {
      facilities: visibleFacilities
        ? ctx.facilities.filter(
            (facility) => facility.active && visibleFacilities.has(facility.id),
          ).length
        : null,
      stock_locations: locationIds
        ? ctx.locations.filter(
            (location) => location.active && locationIds.includes(location.id),
          ).length
        : null,
      departments,
      ingredients,
      suppliers,
      active_users: users,
    };
  }

  private async inventory(
    ctx: Context,
    stats: (facilityId: string) => FacilityStats,
  ) {
    const ids = this.locationIds(ctx, "stock.read");
    if (!ids) return null;
    const locationById = new Map(
      ctx.locations.map((location) => [location.id, location]),
    );
    const facilityById = new Map(
      ctx.facilities.map((facility) => [facility.id, facility]),
    );
    const [balances, prices, rules] = await Promise.all([
      ids.length
        ? this.db.stockBalance.findMany({
            where: { stockLocationId: { in: ids } },
            select: {
              quantity: true,
              stockLocationId: true,
              ingredient: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  group: { select: { id: true, name: true } },
                  baseUnit: { select: { code: true } },
                },
              },
            },
          })
        : [],
      this.db.supplierIngredient.groupBy({
        by: ["ingredientId"],
        where: {
          active: true,
          referencePrice: { not: null },
          supplier: { organizationId: ctx.user.organizationId, active: true },
        },
        _avg: { referencePrice: true },
      }),
      this.db.alertRule.findMany({
        where: {
          organizationId: ctx.user.organizationId,
          thresholdType: "QUANTITY",
        },
        select: {
          id: true,
          facilityId: true,
          ingredientId: true,
          thresholdValue: true,
          active: true,
        },
      }),
    ]);
    const priceByIngredient = new Map(
      prices.map((price) => [
        price.ingredientId,
        decimalOf(price._avg.referencePrice),
      ]),
    );

    let physicalRows = 0;
    let physicalQuantity = ZERO;
    let physicalValue = ZERO;
    let transitQuantity = ZERO;
    let transitValue = ZERO;
    let zeroRows = 0;
    let unpricedRows = 0;
    const groups = new Map<
      string,
      {
        id: string | null;
        name: string;
        quantity: Prisma.Decimal;
        value: Prisma.Decimal;
        rows: number;
      }
    >();
    const items = new Map<
      string,
      {
        ingredient_id: string;
        code: string;
        name: string;
        unit_code: string;
        quantity: Prisma.Decimal;
        value: Prisma.Decimal;
      }
    >();
    const lowStock: Array<{
      stock_location_id: string;
      stock_location_code: string;
      stock_location_name: string;
      facility_id: string;
      facility_name: string;
      ingredient_id: string;
      ingredient_code: string;
      ingredient_name: string;
      unit_code: string;
      quantity: Prisma.Decimal;
      threshold: Prisma.Decimal | null;
      ratio: number;
    }> = [];

    for (const balance of balances) {
      const location = locationById.get(balance.stockLocationId);
      if (!location) continue;
      const price = priceByIngredient.get(balance.ingredient.id);
      const value = price ? balance.quantity.mul(price) : ZERO;
      if (location.type === StockLocationType.IN_TRANSIT) {
        transitQuantity = transitQuantity.add(balance.quantity);
        transitValue = transitValue.add(value);
        continue;
      }
      physicalRows += 1;
      physicalQuantity = physicalQuantity.add(balance.quantity);
      physicalValue = physicalValue.add(value);
      if (!price) unpricedRows += 1;
      if (balance.quantity.lte(0)) zeroRows += 1;

      const facilityStats = stats(location.facilityId);
      facilityStats.stock_rows += 1;
      facilityStats.stock_value = facilityStats.stock_value.add(value);

      const groupKey = balance.ingredient.group?.id ?? "__none__";
      const group = groups.get(groupKey) ?? {
        id: balance.ingredient.group?.id ?? null,
        name: balance.ingredient.group?.name ?? "Chưa phân nhóm",
        quantity: ZERO,
        value: ZERO,
        rows: 0,
      };
      group.quantity = group.quantity.add(balance.quantity);
      group.value = group.value.add(value);
      group.rows += 1;
      groups.set(groupKey, group);

      const item = items.get(balance.ingredient.id) ?? {
        ingredient_id: balance.ingredient.id,
        code: balance.ingredient.code,
        name: balance.ingredient.name,
        unit_code: balance.ingredient.baseUnit.code,
        quantity: ZERO,
        value: ZERO,
      };
      item.quantity = item.quantity.add(balance.quantity);
      item.value = item.value.add(value);
      items.set(balance.ingredient.id, item);

      const rule = resolveThresholdRule(
        rules,
        location.facilityId,
        balance.ingredient.id,
      );
      const threshold = rule?.thresholdValue ?? null;
      const isLow =
        balance.quantity.lte(0) ||
        (threshold !== null && balance.quantity.lte(threshold));
      if (isLow) {
        facilityStats.low_stock += 1;
        lowStock.push({
          stock_location_id: location.id,
          stock_location_code: location.code,
          stock_location_name: location.name,
          facility_id: location.facilityId,
          facility_name: facilityById.get(location.facilityId)?.name ?? "",
          ingredient_id: balance.ingredient.id,
          ingredient_code: balance.ingredient.code,
          ingredient_name: balance.ingredient.name,
          unit_code: balance.ingredient.baseUnit.code,
          quantity: balance.quantity,
          threshold,
          ratio:
            threshold && threshold.gt(0)
              ? Number(balance.quantity.div(threshold))
              : balance.quantity.lte(0)
                ? -1
                : 0,
        });
      }
    }

    lowStock.sort((left, right) => left.ratio - right.ratio);
    return {
      balance_rows: physicalRows,
      total_quantity: physicalQuantity.toFixed(3),
      estimated_value: physicalValue.toFixed(2),
      in_transit_quantity: transitQuantity.toFixed(3),
      in_transit_value: transitValue.toFixed(2),
      zero_stock_rows: zeroRows,
      unpriced_rows: unpricedRows,
      threshold_rules: rules.length,
      low_stock_total: lowStock.length,
      low_stock: lowStock.slice(0, LOW_STOCK_LIMIT).map((row) => ({
        stock_location_id: row.stock_location_id,
        stock_location_code: row.stock_location_code,
        stock_location_name: row.stock_location_name,
        facility_id: row.facility_id,
        facility_name: row.facility_name,
        ingredient_id: row.ingredient_id,
        ingredient_code: row.ingredient_code,
        ingredient_name: row.ingredient_name,
        unit_code: row.unit_code,
        quantity: row.quantity.toFixed(3),
        threshold: row.threshold?.toFixed(3) ?? null,
      })),
      by_group: [...groups.values()]
        .sort((left, right) => right.value.comparedTo(left.value))
        .map((group) => ({
          group_id: group.id,
          name: group.name,
          rows: group.rows,
          quantity: group.quantity.toFixed(3),
          value: group.value.toFixed(2),
        })),
      top_items: [...items.values()]
        .sort(
          (left, right) =>
            right.value.comparedTo(left.value) ||
            right.quantity.comparedTo(left.quantity),
        )
        .slice(0, 8)
        .map((item) => ({
          ingredient_id: item.ingredient_id,
          code: item.code,
          name: item.name,
          unit_code: item.unit_code,
          quantity: item.quantity.toFixed(3),
          value: item.value.toFixed(2),
        })),
    };
  }

  private async movements(ctx: Context) {
    const allowed = this.locationIds(ctx, "stock_ledger.read");
    if (!allowed) return null;
    const physical = new Set(
      ctx.locations
        .filter((location) => location.type === StockLocationType.PHYSICAL)
        .map((location) => location.id),
    );
    const ids = allowed.filter((id) => physical.has(id));
    const rows = ids.length
      ? await this.db.$queryRaw<
          Array<{
            day: string;
            entry_type: string;
            inbound: string;
            outbound: string;
            entries: number;
          }>
        >`
          SELECT
            to_char((posted_at AT TIME ZONE 'UTC') AT TIME ZONE ${DASHBOARD_TIME_ZONE}, 'YYYY-MM-DD') AS day,
            entry_type::text AS entry_type,
            COALESCE(SUM(CASE WHEN quantity > 0 THEN quantity END), 0)::text AS inbound,
            COALESCE(SUM(CASE WHEN quantity < 0 THEN -quantity END), 0)::text AS outbound,
            COUNT(*)::int AS entries
          FROM stock_ledger_entries
          WHERE posted_at >= (${ctx.from.toISOString()}::timestamptz AT TIME ZONE 'UTC')
            AND stock_location_id = ANY(${ids}::uuid[])
          GROUP BY 1, 2
        `
      : [];
    const byDay = new Map(
      ctx.keys.map((key) => [
        key,
        { inbound: ZERO, outbound: ZERO, entries: 0 },
      ]),
    );
    const byType = new Map<
      string,
      { inbound: Prisma.Decimal; outbound: Prisma.Decimal; entries: number }
    >();
    for (const row of rows) {
      const inbound = decimalOf(row.inbound);
      const outbound = decimalOf(row.outbound);
      const entries = Number(row.entries);
      const day = byDay.get(row.day);
      if (day) {
        day.inbound = day.inbound.add(inbound);
        day.outbound = day.outbound.add(outbound);
        day.entries += entries;
      }
      const type = byType.get(row.entry_type) ?? {
        inbound: ZERO,
        outbound: ZERO,
        entries: 0,
      };
      type.inbound = type.inbound.add(inbound);
      type.outbound = type.outbound.add(outbound);
      type.entries += entries;
      byType.set(row.entry_type, type);
    }
    let inboundTotal = ZERO;
    let outboundTotal = ZERO;
    let entriesTotal = 0;
    for (const value of byDay.values()) {
      inboundTotal = inboundTotal.add(value.inbound);
      outboundTotal = outboundTotal.add(value.outbound);
      entriesTotal += value.entries;
    }
    return {
      inbound_total: inboundTotal.toFixed(3),
      outbound_total: outboundTotal.toFixed(3),
      entries_total: entriesTotal,
      series: [...byDay.entries()].map(([date, value]) => ({
        date,
        inbound: value.inbound.toFixed(3),
        outbound: value.outbound.toFixed(3),
        entries: value.entries,
      })),
      by_type: [...byType.entries()]
        .sort((left, right) => right[1].entries - left[1].entries)
        .map(([entryType, value]) => ({
          entry_type: entryType,
          inbound: value.inbound.toFixed(3),
          outbound: value.outbound.toFixed(3),
          entries: value.entries,
        })),
    };
  }

  private async requests(
    ctx: Context,
    stats: (facilityId: string) => FacilityStats,
  ) {
    const where = this.requestWhere(ctx);
    if (!where) return null;
    const today = startOfDayKey(ctx.keys.at(-1)!);
    const [byStatus, pending, created, decided, overdue] = await Promise.all([
      this.db.supplyRequest.groupBy({
        by: ["status", "facilityId"],
        where,
        _count: { _all: true },
      }),
      this.db.supplyRequest.findMany({
        where: { ...where, status: DocumentStatus.SUBMITTED },
        include: {
          facility: { select: { id: true, code: true, name: true } },
          department: { select: { id: true, code: true, name: true } },
          createdBy: { select: { id: true, displayName: true } },
          _count: { select: { lines: true } },
        },
        orderBy: [{ requiredDate: "asc" }, { submittedAt: "asc" }],
        take: LIST_LIMIT,
      }),
      this.db.supplyRequest.findMany({
        where: { ...where, createdAt: { gte: ctx.from } },
        select: { createdAt: true },
      }),
      this.db.supplyRequest.findMany({
        where: {
          ...where,
          decidedAt: { gte: ctx.from },
          status: { in: [DocumentStatus.APPROVED, DocumentStatus.REJECTED] },
        },
        select: { decidedAt: true, status: true },
      }),
      this.db.supplyRequest.count({
        where: {
          ...where,
          status: { in: [DocumentStatus.DRAFT, DocumentStatus.SUBMITTED] },
          requiredDate: { lt: today },
        },
      }),
    ]);
    const statusCounts = this.emptyCounts(Object.values(DocumentStatus));
    let total = 0;
    for (const row of byStatus) {
      statusCounts[row.status] =
        (statusCounts[row.status] ?? 0) + row._count._all;
      total += row._count._all;
      if (row.status === DocumentStatus.SUBMITTED)
        stats(row.facilityId).pending_requests += row._count._all;
    }
    const series = new Map(
      ctx.keys.map((key) => [key, { created: 0, approved: 0, rejected: 0 }]),
    );
    for (const row of created) {
      const bucket = series.get(dayKey(row.createdAt));
      if (bucket) bucket.created += 1;
    }
    for (const row of decided) {
      if (!row.decidedAt) continue;
      const bucket = series.get(dayKey(row.decidedAt));
      if (!bucket) continue;
      if (row.status === DocumentStatus.APPROVED) bucket.approved += 1;
      else bucket.rejected += 1;
    }
    return {
      total,
      by_status: statusCounts,
      overdue,
      created_in_period: created.length,
      pending: pending.map((request) => ({
        id: request.id,
        code: request.code,
        status: request.status,
        required_date: request.requiredDate.toISOString(),
        submitted_at: request.submittedAt?.toISOString() ?? null,
        facility: request.facility,
        department: request.department,
        created_by: request.createdBy,
        line_count: request._count.lines,
      })),
      series: [...series.entries()].map(([date, value]) => ({
        date,
        ...value,
      })),
    };
  }

  private async orders(
    ctx: Context,
    stats: (facilityId: string) => FacilityStats,
  ) {
    const ids = this.locationIds(ctx, "order.read");
    if (!ids) return null;
    const where: Prisma.FulfillmentOrderWhereInput = {
      organizationId: ctx.user.organizationId,
      OR: [
        { destinationStockLocationId: { in: ids } },
        { sourceStockLocationId: { in: ids } },
      ],
    };
    const [byStatus, bySource, lines, openInbound, recent] = await Promise.all([
      this.db.fulfillmentOrder.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      this.db.fulfillmentOrder.groupBy({
        by: ["sourceType"],
        where,
        _count: { _all: true },
      }),
      this.db.fulfillmentLine.aggregate({
        where: {
          order: {
            ...where,
            createdAt: { gte: ctx.from },
            status: { not: OrderStatus.CANCELLED },
          },
        },
        _sum: {
          approvedQuantity: true,
          dispatchedQuantity: true,
          receivedQuantity: true,
          closedRemainingQuantity: true,
        },
        _count: { _all: true },
      }),
      this.db.fulfillmentOrder.groupBy({
        by: ["destinationStockLocationId"],
        where: {
          ...where,
          status: { in: [OrderStatus.RELEASED, OrderStatus.PARTIAL] },
        },
        _count: { _all: true },
      }),
      this.db.fulfillmentOrder.findMany({
        where,
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          sourceStockLocation: { select: { id: true, code: true, name: true } },
          destinationStockLocation: {
            select: { id: true, code: true, name: true },
          },
          lines: {
            select: { approvedQuantity: true, receivedQuantity: true },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: LIST_LIMIT,
      }),
    ]);
    const statusCounts = this.emptyCounts(Object.values(OrderStatus));
    let total = 0;
    for (const row of byStatus) {
      statusCounts[row.status] = row._count._all;
      total += row._count._all;
    }
    const sourceCounts: Record<string, number> = { STOCK: 0, SUPPLIER: 0 };
    for (const row of bySource) sourceCounts[row.sourceType] = row._count._all;
    const locationById = new Map(
      ctx.locations.map((location) => [location.id, location]),
    );
    for (const row of openInbound) {
      const location = locationById.get(row.destinationStockLocationId);
      if (location)
        stats(location.facilityId).open_inbound_orders += row._count._all;
    }
    const approved = decimalOf(lines._sum.approvedQuantity);
    const received = decimalOf(lines._sum.receivedQuantity);
    const dispatched = decimalOf(lines._sum.dispatchedQuantity);
    const closed = decimalOf(lines._sum.closedRemainingQuantity);
    return {
      total,
      by_status: statusCounts,
      by_source_type: sourceCounts,
      open: (statusCounts["RELEASED"] ?? 0) + (statusCounts["PARTIAL"] ?? 0),
      period: {
        lines: lines._count._all,
        approved_quantity: approved.toFixed(3),
        dispatched_quantity: dispatched.toFixed(3),
        received_quantity: received.toFixed(3),
        closed_remaining_quantity: closed.toFixed(3),
        fulfillment_rate: percentage(received, approved),
      },
      recent: recent.map((order) => {
        const orderApproved = order.lines.reduce(
          (sum, line) => sum.add(line.approvedQuantity),
          ZERO,
        );
        const orderReceived = order.lines.reduce(
          (sum, line) => sum.add(line.receivedQuantity),
          ZERO,
        );
        return {
          id: order.id,
          code: order.code,
          status: order.status,
          source_type: order.sourceType,
          supplier: order.supplier,
          source_stock_location: order.sourceStockLocation,
          destination_stock_location: order.destinationStockLocation,
          created_at: order.createdAt.toISOString(),
          progress: percentage(orderReceived, orderApproved) ?? 0,
        };
      }),
    };
  }

  private async delivery(ctx: Context) {
    const dispatchIds = this.locationIds(ctx, "dispatch.read");
    const receiptIds = this.locationIds(ctx, "receipt.read");
    const discrepancyIds = this.locationIds(ctx, "discrepancy.read");
    if (!dispatchIds && !receiptIds && !discrepancyIds) return null;
    const dispatchWhere: Prisma.DispatchWhereInput | null = dispatchIds
      ? { order: { sourceStockLocationId: { in: dispatchIds } } }
      : null;
    const receiptWhere: Prisma.ReceiptWhereInput | null = receiptIds
      ? { order: { destinationStockLocationId: { in: receiptIds } } }
      : null;
    const [
      dispatchDraft,
      dispatchPosted,
      receiptDraft,
      receiptPosted,
      receiptReview,
      discrepancies,
    ] = await Promise.all([
      dispatchWhere
        ? this.db.dispatch.count({
            where: { ...dispatchWhere, status: DispatchStatus.DRAFT },
          })
        : null,
      dispatchWhere
        ? this.db.dispatch.count({
            where: {
              ...dispatchWhere,
              status: DispatchStatus.POSTED,
              postedAt: { gte: ctx.from },
            },
          })
        : null,
      receiptWhere
        ? this.db.receipt.count({
            where: { ...receiptWhere, status: ReceiptStatus.DRAFT },
          })
        : null,
      receiptWhere
        ? this.db.receipt.count({
            where: {
              ...receiptWhere,
              status: ReceiptStatus.POSTED,
              postedAt: { gte: ctx.from },
            },
          })
        : null,
      receiptWhere
        ? this.db.receipt.count({
            where: {
              ...receiptWhere,
              status: ReceiptStatus.PENDING_EXCESS_REVIEW,
            },
          })
        : null,
      discrepancyIds
        ? this.db.discrepancyCase.groupBy({
            by: ["type"],
            where: {
              status: DiscrepancyStatus.OPEN,
              receipt: {
                order: { destinationStockLocationId: { in: discrepancyIds } },
              },
            },
            _count: { _all: true },
          })
        : null,
    ]);
    return {
      dispatches_draft: dispatchDraft,
      dispatches_posted_in_period: dispatchPosted,
      receipts_draft: receiptDraft,
      receipts_posted_in_period: receiptPosted,
      receipts_pending_review: receiptReview,
      open_discrepancies: discrepancies
        ? discrepancies.reduce((sum, row) => sum + row._count._all, 0)
        : null,
      open_discrepancies_by_type: discrepancies
        ? Object.fromEntries(
            discrepancies.map((row) => [row.type, row._count._all]),
          )
        : null,
    };
  }

  private async transfers(ctx: Context) {
    const ids = this.locationIds(ctx, "transfer.read");
    if (!ids) return null;
    const rows = await this.db.transfer.groupBy({
      by: ["status"],
      where: {
        organizationId: ctx.user.organizationId,
        OR: [
          { fromStockLocationId: { in: ids } },
          { toStockLocationId: { in: ids } },
        ],
      },
      _count: { _all: true },
    });
    const counts = this.emptyCounts([
      "DRAFT",
      "SUBMITTED",
      "APPROVED",
      "REJECTED",
      "CANCELLED",
    ]);
    let total = 0;
    for (const row of rows) {
      counts[row.status] = row._count._all;
      total += row._count._all;
    }
    return { total, by_status: counts };
  }

  private async operations(ctx: Context) {
    const adjustmentIds = this.locationIds(ctx, "adjustment.read");
    const stocktakeIds = this.locationIds(ctx, "stocktake.read");
    const damageIds = this.locationIds(ctx, "damage.read");
    const varianceIds = this.locationIds(ctx, "variance.read");
    if (!adjustmentIds && !stocktakeIds && !damageIds && !varianceIds)
      return null;
    const [
      adjustmentsDraft,
      adjustmentsApproved,
      stocktakesOpen,
      damageSubmitted,
      damageConfirmed,
      variances,
    ] = await Promise.all([
      adjustmentIds
        ? this.db.inventoryAdjustment.count({
            where: {
              stockLocationId: { in: adjustmentIds },
              status: AdjustmentStatus.DRAFT,
            },
          })
        : null,
      adjustmentIds
        ? this.db.inventoryAdjustment.count({
            where: {
              stockLocationId: { in: adjustmentIds },
              status: AdjustmentStatus.APPROVED,
            },
          })
        : null,
      stocktakeIds
        ? this.db.stocktake.count({
            where: {
              stockLocationId: { in: stocktakeIds },
              status: { in: [StocktakeStatus.DRAFT, StocktakeStatus.REOPENED] },
            },
          })
        : null,
      damageIds
        ? this.db.damageReport.count({
            where: {
              stockLocationId: { in: damageIds },
              status: DamageStatus.SUBMITTED,
            },
          })
        : null,
      damageIds
        ? this.db.damageReport.count({
            where: {
              stockLocationId: { in: damageIds },
              status: DamageStatus.CONFIRMED,
              confirmedAt: { gte: ctx.from },
            },
          })
        : null,
      varianceIds
        ? this.db.varianceResult.findMany({
            where: {
              organizationId: ctx.user.organizationId,
              stockLocationId: { in: varianceIds },
              calculatedAt: { gte: ctx.from },
            },
            include: {
              ingredient: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  baseUnit: { select: { code: true } },
                },
              },
              stockLocation: { select: { id: true, code: true, name: true } },
            },
            orderBy: [{ calculatedAt: "desc" }, { id: "desc" }],
            take: 50,
          })
        : null,
    ]);
    const varianceRows = variances
      ? [...variances]
          .filter((row) => row.varianceRate !== null)
          .sort(
            (left, right) =>
              Number(right.varianceRate!.abs()) -
              Number(left.varianceRate!.abs()),
          )
          .slice(0, 5)
          .map((row) => ({
            id: row.id,
            ingredient: {
              id: row.ingredient.id,
              code: row.ingredient.code,
              name: row.ingredient.name,
              unit_code: row.ingredient.baseUnit.code,
            },
            stock_location: row.stockLocation,
            variance_quantity: row.varianceQuantity?.toFixed(3) ?? null,
            variance_rate: row.varianceRate?.toFixed(4) ?? null,
            data_status: row.dataStatus,
            calculated_at: row.calculatedAt.toISOString(),
          }))
      : null;
    return {
      adjustments_draft: adjustmentsDraft,
      adjustments_awaiting_post: adjustmentsApproved,
      stocktakes_open: stocktakesOpen,
      damage_awaiting_confirm: damageSubmitted,
      damage_confirmed_in_period: damageConfirmed,
      variance_incomplete: variances
        ? variances.filter((row) => row.dataStatus === "DATA_INCOMPLETE").length
        : null,
      top_variances: varianceRows,
    };
  }

  private async notifications(ctx: Context) {
    if (!this.scope.grantsFor(ctx.user, "notification.read_own").length)
      return null;
    const where = {
      organizationId: ctx.user.organizationId,
      userId: ctx.user.id,
    };
    const [unread, latest] = await Promise.all([
      this.db.notification.count({
        where: { ...where, status: NotificationStatus.UNREAD },
      }),
      this.db.notification.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 5,
      }),
    ]);
    return { unread, latest };
  }

  private async recentActivity(ctx: Context) {
    // Giống /audit-events: chỉ grant cấp tổ chức mới được đọc lịch sử thao tác.
    if (!this.scope.canAccess(ctx.user, "audit.read", {})) return null;
    const events = await this.db.auditEvent.findMany({
      where: { organizationId: ctx.user.organizationId },
      include: {
        actor: { select: { id: true, username: true, displayName: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 8,
    });
    return events.map((event) => ({
      id: event.id,
      action: event.action,
      resource_type: event.resourceType,
      resource_id: event.resourceId,
      actor: event.actor,
      created_at: event.createdAt.toISOString(),
    }));
  }

  // ---------------------------------------------------------------------------
  // Scope helpers
  // ---------------------------------------------------------------------------

  /**
   * Danh sách kho (đã lọc theo cơ sở nếu có) mà người dùng đọc được với quyền
   * `permission`; `null` khi người dùng hoàn toàn không có quyền đó.
   */
  private locationIds(ctx: Context, permission: string): string[] | null {
    if (!this.scope.grantsFor(ctx.user, permission).length) return null;
    const constraints = this.scope.constraintsFor(ctx.user, permission, [
      "facilityId",
      "stockLocationId",
    ]);
    return ctx.locations
      .filter(
        (location) =>
          constraints === null ||
          constraints.some(
            (constraint) =>
              (!constraint.facilityId ||
                constraint.facilityId === location.facilityId) &&
              (!constraint.stockLocationId ||
                constraint.stockLocationId === location.id),
          ),
      )
      .map((location) => location.id);
  }

  private visibleFacilityIds(ctx: Context): Set<string> | null {
    if (!this.scope.grantsFor(ctx.user, "facility.read").length) return null;
    const allowed = this.scope.facilityIds(ctx.user, "facility.read");
    return new Set(
      ctx.facilities
        .filter(
          (facility) =>
            (!allowed || allowed.includes(facility.id)) &&
            (!ctx.facilityId || facility.id === ctx.facilityId),
        )
        .map((facility) => facility.id),
    );
  }

  private departmentWhere(ctx: Context): Prisma.DepartmentWhereInput | null {
    if (!this.scope.grantsFor(ctx.user, "department.read").length) return null;
    const access = this.scope.constraintsFor(ctx.user, "department.read", [
      "facilityId",
      "stockLocationId",
      "departmentId",
    ]);
    return {
      active: true,
      facility: { organizationId: ctx.user.organizationId },
      ...(ctx.facilityId ? { facilityId: ctx.facilityId } : {}),
      ...(access
        ? {
            OR: access.map((item) => ({
              ...(item.facilityId ? { facilityId: item.facilityId } : {}),
              ...(item.stockLocationId
                ? { stockLocationId: item.stockLocationId }
                : {}),
              ...(item.departmentId ? { id: item.departmentId } : {}),
            })),
          }
        : {}),
    };
  }

  private requestWhere(ctx: Context): Prisma.SupplyRequestWhereInput | null {
    if (!this.scope.grantsFor(ctx.user, "request.read").length) return null;
    const access: ResourceScope[] | null = this.scope.constraintsFor(
      ctx.user,
      "request.read",
      ["facilityId", "departmentId", "createdById"],
    );
    return {
      organizationId: ctx.user.organizationId,
      ...(ctx.facilityId ? { facilityId: ctx.facilityId } : {}),
      ...(access
        ? {
            OR: access.map((item) => ({
              ...(item.facilityId ? { facilityId: item.facilityId } : {}),
              ...(item.departmentId ? { departmentId: item.departmentId } : {}),
              ...(item.createdById ? { createdById: item.createdById } : {}),
            })),
          }
        : {}),
    };
  }

  private emptyCounts(keys: readonly string[]): Record<string, number> {
    return Object.fromEntries(keys.map((key) => [key, 0]));
  }
}
