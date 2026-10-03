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
    const where = {
      organizationId: u.organizationId,
      userId: u.id,
      ...(q.status ? { status: q.status } : {}),
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
    if (type === "SupplyRequest") {
      const resource = await this.db.supplyRequest.findFirst({
        where: { id, organizationId: u.organizationId },
      });
      if (
        !resource ||
        !this.scope.canAccess(u, "request.read", {
          facilityId: resource.facilityId,
          departmentId: resource.departmentId,
          createdById: resource.createdById,
        })
      )
        this.notificationNotFound();
      return;
    }
    if (type === "FulfillmentOrder") {
      const resource = await this.db.fulfillmentOrder.findFirst({
        where: { id, organizationId: u.organizationId },
        include: { destinationStockLocation: true, sourceStockLocation: true },
      });
      if (!resource) this.notificationNotFound();
      if (u.kind === "SUPPLIER") {
        if (
          !u.supplierId ||
          resource.supplierId !== u.supplierId ||
          !this.scope.canAccess(u, "supplier_order.read_own", {
            supplierId: resource.supplierId,
          })
        )
          this.notificationNotFound();
        return;
      }
      const canRead =
        this.scope.canAccess(u, "order.read", {
          facilityId: resource.destinationStockLocation.facilityId,
          stockLocationId: resource.destinationStockLocationId,
        }) ||
        (resource.sourceStockLocation
          ? this.scope.canAccess(u, "order.read", {
              facilityId: resource.sourceStockLocation.facilityId,
              stockLocationId: resource.sourceStockLocationId,
            })
          : false);
      if (!canRead) this.notificationNotFound();
      return;
    }
    if (type === "Transfer") {
      const resource = await this.db.transfer.findFirst({
        where: { id, organizationId: u.organizationId },
        include: { fromStockLocation: true, toStockLocation: true },
      });
      if (
        !resource ||
        (!this.scope.canAccess(u, "transfer.read", {
          facilityId: resource.fromStockLocation.facilityId,
          stockLocationId: resource.fromStockLocationId,
        }) &&
          !this.scope.canAccess(u, "transfer.read", {
            facilityId: resource.toStockLocation.facilityId,
            stockLocationId: resource.toStockLocationId,
          }))
      )
        this.notificationNotFound();
      return;
    }
    if (type === "DamageReport") {
      const resource = await this.db.damageReport.findFirst({
        where: {
          id,
          stockLocation: { facility: { organizationId: u.organizationId } },
        },
        include: { stockLocation: true },
      });
      if (
        !resource ||
        !this.scope.canAccess(u, "damage.read", {
          facilityId: resource.stockLocation.facilityId,
          stockLocationId: resource.stockLocationId,
          createdById: resource.createdById,
        })
      )
        this.notificationNotFound();
      return;
    }
    this.notificationNotFound();
  }

  private notificationNotFound(): never {
    throw new ApiException(
      ErrorCode.RESOURCE_NOT_FOUND,
      "Không tìm thấy thông báo hoặc bạn không còn quyền đọc tài nguyên liên quan.",
      HttpStatus.NOT_FOUND,
    );
  }
}
