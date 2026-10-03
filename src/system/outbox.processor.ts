import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service.js";
import { OutboxStatus, Prisma, ScopeType } from "../generated/prisma/client.js";

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
    return this.db.$transaction(
      async (tx) => {
        const event = await tx.outboxEvent.findFirst({
          where: {
            status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] },
            availableAt: { lte: new Date() },
            attempts: { lt: 5 },
          },
          orderBy: { createdAt: "asc" },
        });
        if (!event) return false;
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
          if (notifications.length)
            await tx.notification.createMany({ data: notifications });
          await tx.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: OutboxStatus.COMPLETED,
              processedAt: new Date(),
              lastError: null,
            },
          });
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
        }
        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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
        include: { orders: { select: { supplierId: true } } },
      });
      if (!request) return [];
      const recipientIds = new Set<string>([request.createdById]);
      const supplierIds = request.orders.flatMap((order) =>
        order.supplierId ? [order.supplierId] : [],
      );
      if (supplierIds.length) {
        const supplierUsers = await tx.user.findMany({
          where: {
            organizationId: request.organizationId,
            supplierId: { in: supplierIds },
            active: true,
          },
          select: { id: true },
        });
        supplierUsers.forEach((user) => recipientIds.add(user.id));
      }
      return [...recipientIds].map((userId) => ({
        organizationId: request.organizationId,
        userId,
        title: "Yêu cầu hàng đã được duyệt",
        message: `Yêu cầu ${request.code} đã được duyệt và phát hành đơn.`,
        resourceType: "SupplyRequest",
        resourceId: request.id,
      }));
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
