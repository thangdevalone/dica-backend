import { HttpStatus, Injectable } from "@nestjs/common";
import type { AuthUser } from "../auth/auth.types.js";
import { ScopeService } from "../auth/scope.service.js";
import { PrismaService } from "../database/prisma.service.js";
import { ApiException } from "../common/errors/api.exception.js";
import { ErrorCode } from "../common/errors/error-codes.js";
import { paginateById } from "../common/pagination/pagination.js";
import type { Prisma } from "../generated/prisma/client.js";
import type {
  InventoryListQueryDto,
  LedgerListQueryDto,
  NotificationListQueryDto,
} from "./inventory.dto.js";
@Injectable()
export class InventoryService {
  constructor(
    private db: PrismaService,
    private scope: ScopeService,
  ) {}
  async balances(u: AuthUser, q: InventoryListQueryDto) {
    const access = this.scope.constraintsFor(u, "stock.read", [
      "facilityId",
      "stockLocationId",
    ]);
    const search = q.search?.trim();
    const where: Prisma.StockBalanceWhereInput = {
      ...(q.stock_location_id ? { stockLocationId: q.stock_location_id } : {}),
      ...(q.ingredient_id ? { ingredientId: q.ingredient_id } : {}),
      ...(search
        ? {
            ingredient: {
              OR: [
                { code: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
      stockLocation: {
        facility: {
          organizationId: u.organizationId,
        },
        ...(q.facility_id ? { facilityId: q.facility_id } : {}),
        ...(access
          ? {
              OR: access.map((item) => ({
                ...(item.facilityId ? { facilityId: item.facilityId } : {}),
                ...(item.stockLocationId ? { id: item.stockLocationId } : {}),
              })),
            }
          : {}),
      },
    };
    const { data, meta } = await paginateById(
      q,
      ({ skip, take, cursorId }) =>
        this.db.stockBalance.findMany({
          where,
          include: {
            stockLocation: { include: { facility: true } },
            ingredient: { include: { baseUnit: true } },
          },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.stockBalance.count({ where }),
      { searchHandled: true },
    );
    return {
      data,
      message: "Lấy số dư tồn kho thành công.",
      meta,
    };
  }
  async ledger(u: AuthUser, q: LedgerListQueryDto) {
    const access = this.scope.constraintsFor(u, "stock_ledger.read", [
      "facilityId",
      "stockLocationId",
    ]);
    const where: Prisma.StockLedgerEntryWhereInput = {
      ...(q.stock_location_id ? { stockLocationId: q.stock_location_id } : {}),
      ...(q.ingredient_id ? { ingredientId: q.ingredient_id } : {}),
      ...(q.entry_type ? { entryType: q.entry_type } : {}),
      stockLocation: {
        facility: {
          organizationId: u.organizationId,
        },
        ...(q.facility_id ? { facilityId: q.facility_id } : {}),
        ...(access
          ? {
              OR: access.map((item) => ({
                ...(item.facilityId ? { facilityId: item.facilityId } : {}),
                ...(item.stockLocationId ? { id: item.stockLocationId } : {}),
              })),
            }
          : {}),
      },
    };
    const { data, meta } = await paginateById(
      q,
      ({ skip, take, cursorId }) =>
        this.db.stockLedgerEntry.findMany({
          where,
          include: {
            stockLocation: true,
            ingredient: { include: { baseUnit: true } },
          },
          orderBy: [{ postedAt: "desc" }, { id: "desc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.stockLedgerEntry.count({ where }),
    );
    return {
      data,
      message: "Lấy sổ chi tiết tồn kho thành công.",
      meta,
    };
  }
  async notifications(u: AuthUser, q: NotificationListQueryDto) {
    const baseWhere: Prisma.NotificationWhereInput = {
      organizationId: u.organizationId,
      userId: u.id,
      ...(q.status ? { status: q.status } : {}),
    };
    const authorizedIds = await this.authorizedNotificationIds(u, baseWhere);
    const where: Prisma.NotificationWhereInput = {
      ...baseWhere,
      id: { in: authorizedIds },
    };
    const { data, meta } = await paginateById(
      q,
      ({ skip, take, cursorId }) =>
        this.db.notification.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.notification.count({ where }),
    );
    return {
      data,
      message: "Lấy thông báo của bạn thành công.",
      meta,
    };
  }

  /**
   * Notification lưu resource đa hình nên không thể JOIN trực tiếp bằng Prisma.
   * Gom resource theo loại, authorize bằng scope hiện tại, rồi mới đưa danh sách ID
   * hợp lệ vào query phân trang để không lộ preview/count sau khi bị thu hồi quyền.
   */
  private async authorizedNotificationIds(
    u: AuthUser,
    where: Prisma.NotificationWhereInput,
  ): Promise<string[]> {
    const notifications = await this.db.notification.findMany({
      where,
      select: {
        id: true,
        resourceType: true,
        resourceId: true,
        requiredPermission: true,
      },
    });
    if (notifications.length === 0) return [];

    const idsFor = (type: string) => [
      ...new Set(
        notifications
          .filter((notification) => notification.resourceType === type)
          .map((notification) => notification.resourceId),
      ),
    ];
    const requestIds = idsFor("SupplyRequest");
    const orderIds = idsFor("FulfillmentOrder");
    const transferIds = idsFor("Transfer");
    const damageIds = idsFor("DamageReport");
    const discrepancyIds = idsFor("DiscrepancyCase");
    const stocktakeIds = idsFor("Stocktake");
    const returnIds = idsFor("ReturnDocument");
    const supplierIds = idsFor("Supplier");
    const saleIds = idsFor("SalesRecord");

    const [
      requests,
      orders,
      transfers,
      damages,
      discrepancies,
      stocktakes,
      returns,
      suppliers,
      sales,
    ] = await Promise.all([
      requestIds.length
        ? this.db.supplyRequest.findMany({
            where: {
              id: { in: requestIds },
              organizationId: u.organizationId,
            },
            select: {
              id: true,
              facilityId: true,
              departmentId: true,
              createdById: true,
            },
          })
        : [],
      orderIds.length
        ? this.db.fulfillmentOrder.findMany({
            where: { id: { in: orderIds }, organizationId: u.organizationId },
            select: {
              id: true,
              supplierId: true,
              destinationStockLocationId: true,
              destinationStockLocation: { select: { facilityId: true } },
              sourceStockLocationId: true,
              sourceStockLocation: { select: { facilityId: true } },
            },
          })
        : [],
      transferIds.length
        ? this.db.transfer.findMany({
            where: {
              id: { in: transferIds },
              organizationId: u.organizationId,
            },
            select: {
              id: true,
              fromStockLocationId: true,
              fromStockLocation: { select: { facilityId: true } },
              toStockLocationId: true,
              toStockLocation: { select: { facilityId: true } },
            },
          })
        : [],
      damageIds.length
        ? this.db.damageReport.findMany({
            where: {
              id: { in: damageIds },
              stockLocation: {
                facility: { organizationId: u.organizationId },
              },
            },
            select: {
              id: true,
              stockLocationId: true,
              createdById: true,
              stockLocation: { select: { facilityId: true } },
            },
          })
        : [],
      discrepancyIds.length
        ? this.db.discrepancyCase.findMany({
            where: {
              id: { in: discrepancyIds },
              receipt: {
                order: { organizationId: u.organizationId },
              },
            },
            select: {
              id: true,
              receipt: {
                select: {
                  order: {
                    select: {
                      destinationStockLocationId: true,
                      destinationStockLocation: {
                        select: { facilityId: true },
                      },
                    },
                  },
                },
              },
            },
          })
        : [],
      stocktakeIds.length
        ? this.db.stocktake.findMany({
            where: {
              id: { in: stocktakeIds },
              stockLocation: {
                facility: { organizationId: u.organizationId },
              },
            },
            select: {
              id: true,
              stockLocationId: true,
              createdById: true,
              stockLocation: { select: { facilityId: true } },
            },
          })
        : [],
      returnIds.length
        ? this.db.returnDocument.findMany({
            where: {
              id: { in: returnIds },
              order: { organizationId: u.organizationId },
            },
            select: {
              id: true,
              createdById: true,
              order: {
                select: {
                  destinationStockLocationId: true,
                  destinationStockLocation: { select: { facilityId: true } },
                },
              },
            },
          })
        : [],
      supplierIds.length
        ? this.db.supplier.findMany({
            where: {
              id: { in: supplierIds },
              organizationId: u.organizationId,
            },
            select: { id: true },
          })
        : [],
      saleIds.length
        ? this.db.salesRecord.findMany({
            where: { id: { in: saleIds }, organizationId: u.organizationId },
            select: {
              id: true,
              batch: { select: { facilityId: true, createdById: true } },
            },
          })
        : [],
    ]);

    const allowed = new Set<string>();
    for (const resource of requests) {
      if (
        this.scope.canAccess(u, "request.read", {
          facilityId: resource.facilityId,
          departmentId: resource.departmentId,
          createdById: resource.createdById,
        })
      )
        allowed.add(`SupplyRequest:${resource.id}`);
    }
    for (const resource of orders) {
      const canRead =
        u.kind === "SUPPLIER"
          ? Boolean(
              u.supplierId &&
              resource.supplierId === u.supplierId &&
              this.scope.canAccess(u, "supplier_order.read_own", {
                supplierId: resource.supplierId,
              }),
            )
          : this.scope.canAccess(u, "order.read", {
              facilityId: resource.destinationStockLocation.facilityId,
              stockLocationId: resource.destinationStockLocationId,
            }) ||
            Boolean(
              resource.sourceStockLocation &&
              this.scope.canAccess(u, "order.read", {
                facilityId: resource.sourceStockLocation.facilityId,
                stockLocationId: resource.sourceStockLocationId,
              }),
            );
      if (canRead) allowed.add(`FulfillmentOrder:${resource.id}`);
    }
    for (const resource of transfers) {
      if (
        this.scope.canAccess(u, "transfer.read", {
          facilityId: resource.fromStockLocation.facilityId,
          stockLocationId: resource.fromStockLocationId,
        }) ||
        this.scope.canAccess(u, "transfer.read", {
          facilityId: resource.toStockLocation.facilityId,
          stockLocationId: resource.toStockLocationId,
        })
      )
        allowed.add(`Transfer:${resource.id}`);
    }
    for (const resource of damages) {
      if (
        this.scope.canAccess(u, "damage.read", {
          facilityId: resource.stockLocation.facilityId,
          stockLocationId: resource.stockLocationId,
          createdById: resource.createdById,
        })
      )
        allowed.add(`DamageReport:${resource.id}`);
    }
    for (const resource of discrepancies) {
      const destination = resource.receipt.order.destinationStockLocation;
      if (
        this.scope.canAccess(u, "discrepancy.read", {
          facilityId: destination.facilityId,
          stockLocationId: resource.receipt.order.destinationStockLocationId,
        })
      )
        allowed.add(`DiscrepancyCase:${resource.id}`);
    }
    for (const resource of stocktakes) {
      if (
        this.scope.canAccess(u, "stocktake.read", {
          facilityId: resource.stockLocation.facilityId,
          stockLocationId: resource.stockLocationId,
          createdById: resource.createdById,
        })
      )
        allowed.add(`Stocktake:${resource.id}`);
    }

    for (const resource of returns) {
      if (
        this.scope.canAccess(u, "return.read", {
          facilityId: resource.order.destinationStockLocation.facilityId,
          stockLocationId: resource.order.destinationStockLocationId,
          createdById: resource.createdById,
        })
      )
        allowed.add(`ReturnDocument:${resource.id}`);
    }
    for (const resource of suppliers) {
      if (this.scope.canAccess(u, "price_alert.read", {}))
        allowed.add(`Supplier:${resource.id}`);
    }
    for (const resource of sales) {
      const context = {
        facilityId: resource.batch.facilityId,
        createdById: resource.batch.createdById,
      };
      if (
        this.scope.canAccess(u, "sales_import.read", context) ||
        this.scope.canAccess(u, "variance.read", context)
      )
        allowed.add(`SalesRecord:${resource.id}`);
    }

    const orderScopes = new Map(
      orders.map((order) => [
        order.id,
        {
          facilityId: order.destinationStockLocation.facilityId,
          stockLocationId: order.destinationStockLocationId,
        },
      ]),
    );
    return notifications
      .filter(
        (notification) =>
          (!notification.requiredPermission ||
            this.scope.canAccess(
              u,
              notification.requiredPermission,
              notification.resourceType === "FulfillmentOrder"
                ? (orderScopes.get(notification.resourceId) ?? {})
                : {},
            )) &&
          (u.kind !== "SUPPLIER" ||
            notification.resourceType === "FulfillmentOrder") &&
          allowed.has(
            `${notification.resourceType}:${notification.resourceId}`,
          ),
      )
      .map((notification) => notification.id);
  }

  async readableNotificationIds(u: AuthUser, ids: string[]) {
    if (
      !u.grants.some((grant) =>
        grant.permissions.includes("notification.read_own"),
      )
    )
      return [];
    return this.authorizedNotificationIds(u, {
      organizationId: u.organizationId,
      userId: u.id,
      status: "UNREAD",
      id: { in: ids },
    });
  }

  async notification(u: AuthUser, id: string) {
    const notification = await this.db.notification.findFirst({
      where: { id, organizationId: u.organizationId, userId: u.id },
    });
    if (!notification) this.notificationNotFound();
    await this.authorizeNotificationResource(
      u,
      notification.resourceType,
      notification.resourceId,
    );
    return { data: notification, message: "Mở thông báo thành công." };
  }

  async markAllNotificationsRead(u: AuthUser) {
    const result = await this.db.notification.updateMany({
      where: {
        organizationId: u.organizationId,
        userId: u.id,
        status: "UNREAD",
      },
      data: { status: "READ", readAt: new Date() },
    });
    return {
      data: { updated: result.count },
      message: "Đã đánh dấu tất cả thông báo là đã đọc.",
    };
  }

  async markNotificationRead(u: AuthUser, id: string) {
    const notification = await this.db.notification.findFirst({
      where: { id, organizationId: u.organizationId, userId: u.id },
    });
    if (!notification) this.notificationNotFound();
    await this.authorizeNotificationResource(
      u,
      notification.resourceType,
      notification.resourceId,
    );
    const data = await this.db.notification.update({
      where: { id },
      data: { status: "READ", readAt: notification.readAt ?? new Date() },
    });
    return { data, message: "Đánh dấu thông báo đã đọc thành công." };
  }

  private async authorizeNotificationResource(
    u: AuthUser,
    type: string,
    id: string,
  ) {
    const allowed = await this.authorizedNotificationIds(u, {
      organizationId: u.organizationId,
      userId: u.id,
      resourceType: type,
      resourceId: id,
    });
    if (allowed.length === 0) this.notificationNotFound();
  }

  private notificationNotFound(): never {
    throw new ApiException(
      ErrorCode.RESOURCE_NOT_FOUND,
      "Không tìm thấy thông báo hoặc bạn không còn quyền đọc tài nguyên liên quan.",
      HttpStatus.NOT_FOUND,
    );
  }
}
