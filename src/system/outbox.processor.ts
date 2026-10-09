import { notifyPermission } from "../common/utils/notify.js";
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service.js";
import { OutboxStatus, Prisma, ScopeType } from "../generated/prisma/client.js";
import { PushService } from "../push/push.service.js";

interface GrantShape {
  scopeType: ScopeType;
  facilityId: string | null;
  stockLocationId: string | null;
  departmentId: string | null;
  role: { permissions: Array<{ permissionCode: string }> };
}

@Injectable()
export class OutboxProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxProcessor.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private lastMaintenanceAt = 0;

  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
    private readonly push: PushService,
  ) {}

  onModuleInit() {
    if (this.config.get("NODE_ENV") === "test") return;
    this.timer = setInterval(() => void this.tick(), 5_000);
    this.timer.unref();
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.runMaintenance();
      for (let index = 0; index < 20; index += 1) {
        const processed = await this.processOne();
        if (!processed) break;
      }
    } catch (error) {
      this.logger.error(
        "Xử lý outbox thất bại.",
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }

  private async runMaintenance() {
    const now = Date.now();
    if (now - this.lastMaintenanceAt < 60 * 60 * 1_000) return;
    await this.db.idempotencyRecord.deleteMany({
      where: { expiresAt: { lt: new Date(now) } },
    });
    this.lastMaintenanceAt = now;
  }

  private async processOne() {
    const result = await this.db.$transaction(
      async (tx) => {
        const event = await tx.outboxEvent.findFirst({
          where: {
            type: { not: "ATTACHMENT_PURGE" },
            status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] },
            availableAt: { lte: new Date() },
            attempts: { lt: 5 },
          },
          orderBy: { createdAt: "asc" },
        });
        if (!event) return { processed: false, notifications: [] };
        await tx.outboxEvent.update({
          where: { id: event.id },
          data: { status: OutboxStatus.PROCESSING, attempts: { increment: 1 } },
        });
        try {
          const notifications = await this.buildNotifications(
            tx,
            event.type,
            event.aggregateId,
          );
          const created = [];
          for (const notification of notifications)
            created.push(await tx.notification.create({ data: notification }));
          await tx.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: OutboxStatus.COMPLETED,
              processedAt: new Date(),
              lastError: null,
            },
          });
          return { processed: true, notifications: created };
        } catch (error) {
          await tx.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: OutboxStatus.FAILED,
              lastError: (error instanceof Error
                ? error.message
                : String(error)
              ).slice(0, 2_000),
              availableAt: new Date(Date.now() + 30_000),
            },
          });
          return { processed: true, notifications: [] };
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if (result.notifications.length)
      await this.push.sendNotifications(result.notifications);
    return result.processed;
  }

  private async buildNotifications(
    tx: Prisma.TransactionClient,
    type: string,
    aggregateId: string,
  ): Promise<Prisma.NotificationCreateManyInput[]> {
    if (type === "REQUEST_SUBMITTED") {
      const request = await tx.supplyRequest.findUnique({
        where: { id: aggregateId },
      });
      if (!request) return [];
      const users = await this.usersWithPermission(
        tx,
        request.organizationId,
        "request.approve",
      );
      return users
        .filter((user) =>
          user.grants.some(
            (grant) =>
              this.hasPermission(grant, "request.approve") &&
              this.matches(
                grant,
                request.facilityId,
                null,
                request.departmentId,
                request.createdById,
                user.id,
              ),
          ),
        )
        .map((user) => ({
          organizationId: request.organizationId,
          userId: user.id,
          title: "Yêu cầu hàng chờ duyệt",
          message: `Yêu cầu ${request.code} đang chờ bạn duyệt.`,
          resourceType: "SupplyRequest",
          resourceId: request.id,
        }));
    }

    if (type === "REQUEST_APPROVED") {
      const request = await tx.supplyRequest.findUnique({
        where: { id: aggregateId },
        include: {
          orders: { select: { id: true, code: true, supplierId: true } },
        },
      });
      if (!request) return [];
      const supplierIds = request.orders.flatMap((order) =>
        order.supplierId ? [order.supplierId] : [],
      );
      const supplierUsers = supplierIds.length
        ? await tx.user.findMany({
            where: {
              organizationId: request.organizationId,
              supplierId: { in: supplierIds },
              active: true,
            },
            select: { id: true, supplierId: true },
          })
        : [];
      const notifications: Prisma.NotificationCreateManyInput[] = [
        {
          organizationId: request.organizationId,
          userId: request.createdById,
          title: "Yêu cầu hàng đã được duyệt",
          message: `Yêu cầu ${request.code} đã được duyệt và phát hành đơn.`,
          resourceType: "SupplyRequest",
          resourceId: request.id,
        },
      ];
      for (const order of request.orders)
        for (const user of supplierUsers)
          if (user.supplierId === order.supplierId)
            notifications.push({
              organizationId: request.organizationId,
              userId: user.id,
              title: "Đơn nhà cung cấp mới",
              message: `Đơn ${order.code} đã được phát hành cho nhà cung cấp.`,
              resourceType: "FulfillmentOrder",
              resourceId: order.id,
            });
      return notifications;
    }

    if (type === "REQUEST_REJECTED") {
      const request = await tx.supplyRequest.findUnique({
        where: { id: aggregateId },
      });
      if (!request) return [];
      return [
        {
          organizationId: request.organizationId,
          userId: request.createdById,
          title: "Yêu cầu hàng bị từ chối",
          message: `Yêu cầu ${request.code} đã bị từ chối. Mở phiếu để xem lý do.`,
          resourceType: "SupplyRequest",
          resourceId: request.id,
        },
      ];
    }

    if (type === "TRANSFER_SUBMITTED") {
      const transfer = await tx.transfer.findUnique({
        where: { id: aggregateId },
        include: { fromStockLocation: true },
      });
      if (!transfer) return [];
      const users = await this.usersWithPermission(
        tx,
        transfer.organizationId,
        "transfer.approve",
      );
      return users
        .filter((user) =>
          user.grants.some(
            (grant) =>
              this.hasPermission(grant, "transfer.approve") &&
              this.matches(
                grant,
                transfer.fromStockLocation.facilityId,
                transfer.fromStockLocationId,
                null,
                transfer.createdById,
                user.id,
              ),
          ),
        )
        .map((user) => ({
          organizationId: transfer.organizationId,
          userId: user.id,
          title: "Điều chuyển chờ duyệt",
          message: `Điều chuyển ${transfer.code} đang chờ bạn duyệt.`,
          resourceType: "Transfer",
          resourceId: transfer.id,
        }));
    }

    if (type === "TRANSFER_APPROVED" || type === "TRANSFER_REJECTED") {
      const transfer = await tx.transfer.findUnique({
        where: { id: aggregateId },
        include: {
          toStockLocation: true,
          orders: { select: { id: true, code: true }, take: 1 },
        },
      });
      if (!transfer) return [];
      const approved = type === "TRANSFER_APPROVED";
      const notifications: Prisma.NotificationCreateManyInput[] = [
        {
          organizationId: transfer.organizationId,
          userId: transfer.createdById,
          title: approved
            ? "Điều chuyển đã được duyệt"
            : "Điều chuyển bị từ chối",
          message: approved
            ? `Điều chuyển ${transfer.code} đã được duyệt và sẵn sàng xử lý.`
            : `Điều chuyển ${transfer.code} đã bị từ chối.`,
          resourceType: "Transfer",
          resourceId: transfer.id,
        },
      ];
      if (type === "TRANSFER_APPROVED") {
        await notifyPermission(
          tx,
          transfer.organizationId,
          "transfer.approve",
          {
            facilityId: transfer.toStockLocation.facilityId,
            stockLocationId: transfer.toStockLocationId,
          },
          "Điều chuyển đã được phát hành",
          `Phiếu ${transfer.code} đã được phát hành, bao gồm tuyến tự duyệt Kho tổng/Bếp tổng.`,
          "Transfer",
          transfer.id,
        );
        const receivers = await this.usersWithPermission(
          tx,
          transfer.organizationId,
          "receipt.create",
        );
        const order = transfer.orders[0];
        if (order)
          receivers
            .filter((user) =>
              user.grants.some(
                (grant) =>
                  this.hasPermission(grant, "receipt.create") &&
                  this.matches(
                    grant,
                    transfer.toStockLocation.facilityId,
                    transfer.toStockLocationId,
                    null,
                    transfer.createdById,
                    user.id,
                  ),
              ),
            )
            .forEach((user) =>
              notifications.push({
                organizationId: transfer.organizationId,
                userId: user.id,
                title: "Có điều chuyển cần nhận hàng",
                message: `Đơn ${order.code} từ điều chuyển ${transfer.code} đã sẵn sàng xử lý.`,
                resourceType: "FulfillmentOrder",
                resourceId: order.id,
              }),
            );
      }
      return notifications;
    }

    if (type === "DAMAGE_SUBMITTED") {
      const report = await tx.damageReport.findUnique({
        where: { id: aggregateId },
        include: { stockLocation: { include: { facility: true } } },
      });
      if (!report) return [];
      const users = await this.usersWithPermission(
        tx,
        report.stockLocation.facility.organizationId,
        "damage.confirm",
      );
      return users
        .filter((user) =>
          user.grants.some(
            (grant) =>
              this.hasPermission(grant, "damage.confirm") &&
              this.matches(
                grant,
                report.stockLocation.facilityId,
                report.stockLocationId,
                null,
                report.createdById,
                user.id,
              ),
          ),
        )
        .map((user) => ({
          organizationId: report.stockLocation.facility.organizationId,
          userId: user.id,
          title: "Báo hỏng chờ xử lý",
          message: `Báo hỏng ${report.code} đang chờ xử lý.`,
          resourceType: "DamageReport",
          resourceId: report.id,
        }));
    }

    if (type === "DAMAGE_CONFIRMED") {
      const report = await tx.damageReport.findUnique({
        where: { id: aggregateId },
        include: { stockLocation: { include: { facility: true } } },
      });
      if (!report) return [];
      return [
        {
          organizationId: report.stockLocation.facility.organizationId,
          userId: report.createdById,
          title: "Báo hỏng đã được xác nhận",
          message: `Báo hỏng ${report.code} đã được xác nhận.`,
          resourceType: "DamageReport",
          resourceId: report.id,
        },
      ];
    }

    if (type === "STOCKTAKE_SUBMITTED") {
      const stocktake = await tx.stocktake.findUnique({
        where: { id: aggregateId },
        include: {
          stockLocation: { include: { facility: true } },
          lines: true,
        },
      });
      if (
        !stocktake ||
        !stocktake.lines.some(
          (line) => line.varianceQuantity?.isZero() === false,
        )
      )
        return [];
      const users = await this.usersWithPermission(
        tx,
        stocktake.stockLocation.facility.organizationId,
        "variance.read",
      );
      return users
        .filter((user) =>
          user.grants.some(
            (grant) =>
              this.hasPermission(grant, "variance.read") &&
              this.matches(
                grant,
                stocktake.stockLocation.facilityId,
                stocktake.stockLocationId,
                null,
                stocktake.createdById,
                user.id,
              ),
          ),
        )
        .map((user) => ({
          organizationId: stocktake.stockLocation.facility.organizationId,
          userId: user.id,
          title: "Kiểm kê có sai lệch",
          message: `Phiếu kiểm kê ngày ${stocktake.businessDate.toISOString().slice(0, 10)} có chênh lệch cần kiểm tra.`,
          resourceType: "Stocktake",
          resourceId: stocktake.id,
        }));
    }

    if (type === "RECEIPT_DISCREPANCY") {
      const receipt = await tx.receipt.findUnique({
        where: { id: aggregateId },
        include: {
          order: {
            include: {
              destinationStockLocation: { include: { facility: true } },
            },
          },
          discrepancies: { where: { status: "OPEN" } },
        },
      });
      if (!receipt || !receipt.discrepancies.length) return [];
      const location = receipt.order.destinationStockLocation;
      const users = await this.usersWithPermission(
        tx,
        location.facility.organizationId,
        "discrepancy.resolve",
      );
      const recipients = users.filter((user) =>
        user.grants.some(
          (grant) =>
            this.hasPermission(grant, "discrepancy.resolve") &&
            this.matches(
              grant,
              location.facilityId,
              location.id,
              null,
              receipt.createdById,
              user.id,
            ),
        ),
      );
      return receipt.discrepancies.flatMap((discrepancy) =>
        recipients.map((user) => ({
          organizationId: location.facility.organizationId,
          userId: user.id,
          title: "Nhận hàng có sai lệch",
          message: `Phiếu nhận ${receipt.code} có sai lệch ${discrepancy.type.toLowerCase()} cần xử lý.`,
          resourceType: "DiscrepancyCase",
          resourceId: discrepancy.id,
        })),
      );
    }
    return [];
  }

  private usersWithPermission(
    tx: Prisma.TransactionClient,
    organizationId: string,
    permission: string,
  ) {
    return tx.user.findMany({
      where: {
        organizationId,
        active: true,
        grants: {
          some: {
            revokedAt: null,
            role: {
              active: true,
              permissions: { some: { permissionCode: permission } },
            },
          },
        },
      },
      include: {
        grants: {
          where: { revokedAt: null, role: { active: true } },
          include: { role: { include: { permissions: true } } },
        },
      },
    });
  }

  private hasPermission(grant: GrantShape, permission: string) {
    return grant.role.permissions.some(
      (entry) => entry.permissionCode === permission,
    );
  }

  private matches(
    grant: GrantShape,
    facilityId: string,
    stockLocationId: string | null,
    departmentId: string | null,
    createdById: string,
    recipientId: string,
  ) {
    if (grant.scopeType === ScopeType.ORGANIZATION) return true;
    if (grant.scopeType === ScopeType.SUPPLIER) return false;
    if (grant.scopeType === ScopeType.OWN && createdById !== recipientId)
      return false;
    if (grant.facilityId && grant.facilityId !== facilityId) return false;
    if (grant.stockLocationId && grant.stockLocationId !== stockLocationId)
      return false;
    if (grant.departmentId && grant.departmentId !== departmentId) return false;
    return (
      grant.scopeType === ScopeType.OWN ||
      Boolean(grant.facilityId || grant.stockLocationId || grant.departmentId)
    );
  }
}
