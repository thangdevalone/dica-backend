import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service.js";
import { Prisma } from "../generated/prisma/client.js";
import { PushService } from "../push/push.service.js";
import { R2StorageService } from "../attachments/r2-storage.service.js";
import { notifyPermission } from "../common/utils/notify.js";
import { paymentStatus, paymentValue } from "../common/utils/payment.js";

@Injectable()
export class WorkflowWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkflowWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
    private readonly push: PushService,
    private readonly storage: R2StorageService,
  ) {}
  onModuleInit() {
    if (this.config.get("NODE_ENV") === "test") return;
    this.timer = setInterval(() => void this.tick(), 30_000);
    this.timer.unref();
    void this.tick();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async tick(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      for (const [step, run] of [
        ["closeShortages", () => this.closeShortages(now)],
        ["settleReturns", () => this.settleReturns(now)],
        ["dueNotifications", () => this.dueNotifications(now)],
        ["remind", () => this.remind(now)],
        ["expireImages", () => this.expireImages(now)],
      ] as const) {
        try {
          await run();
        } catch (error) {
          this.logger.error(
            `Workflow step failed: ${step}; will retry.`,
            error instanceof Error
              ? (error.stack ?? error.message)
              : String(error),
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  async closeShortages(now: Date) {
    const orders = await this.db.fulfillmentOrder.findMany({
      where: {
        status: { in: ["RELEASED", "PARTIAL"] },
        shortageDeadlineAt: { lte: now },
      },
      orderBy: [{ shortageDeadlineAt: "asc" }, { id: "asc" }],
      take: 100,
      select: { id: true },
    });
    for (const candidate of orders)
      await this.db.$transaction(
        async (tx) => {
          const order = await tx.fulfillmentOrder.findUniqueOrThrow({
            where: { id: candidate.id },
            include: {
              lines: true,
              destinationStockLocation: true,
              sourceStockLocation: true,
            },
          });
          if (
            !["RELEASED", "PARTIAL"].includes(order.status) ||
            !order.shortageDeadlineAt ||
            order.shortageDeadlineAt > now
          )
            return;
          for (const line of order.lines) {
            const missing = Prisma.Decimal.max(
              line.approvedQuantity
                .sub(line.receivedQuantity)
                .sub(line.closedRemainingQuantity),
              0,
            );
            if (missing.gt(0))
              await tx.fulfillmentLine.update({
                where: { id: line.id },
                data: {
                  closedRemainingQuantity: { increment: missing },
                  version: { increment: 1 },
                },
              });
            const transitMissing = Prisma.Decimal.max(
              line.dispatchedQuantity.sub(line.receivedQuantity),
              0,
            );
            if (transitMissing.gt(0) && order.sourceStockLocation) {
              const transit = await tx.stockLocation.findFirst({
                where: {
                  facilityId: order.sourceStockLocation.facilityId,
                  type: "IN_TRANSIT",
                },
              });
              if (!transit)
                throw new Error(
                  `Missing transit location for order ${order.id}`,
                );
              await this.movement(
                tx,
                transit.id,
                line.ingredientId,
                transitMissing.neg(),
                "DAMAGE",
                "ShortageExpiry",
                order.id,
                line.id,
                null,
              );
            }
          }
          await tx.fulfillmentOrder.update({
            where: { id: order.id },
            data: { status: "CLOSED", version: { increment: 1 } },
          });
          await tx.dispatch.updateMany({
            where: { orderId: order.id, status: "DRAFT" },
            data: { status: "CANCELLED", version: { increment: 1 } },
          });
          await tx.receipt.updateMany({
            where: { orderId: order.id, status: "DRAFT" },
            data: { status: "CANCELLED", version: { increment: 1 } },
          });
          await tx.discrepancyCase.updateMany({
            where: {
              type: "SHORTAGE",
              status: "OPEN",
              receipt: { orderId: order.id },
            },
            data: {
              status: "RESOLVED",
              resolution: "CANCELLED_AT_DAY_END",
              resolvedAt: now,
            },
          });
          await this.reconcile(tx, order.id);
          await tx.auditEvent.create({
            data: {
              organizationId: order.organizationId,
              action: "order.shortage_expired",
              resourceType: "FulfillmentOrder",
              resourceId: order.id,
              requestId: `shortage:${order.id}`,
              afterData: {
                policy: "CANCEL_MISSING_AT_MIDNIGHT",
                deadline: order.shortageDeadlineAt.toISOString(),
                lines: order.lines.map((line) => ({
                  id: line.id,
                  approved: line.approvedQuantity.toString(),
                  received: line.receivedQuantity.toString(),
                })),
              },
            },
          });
          await notifyPermission(
            tx,
            order.organizationId,
            "order.close_outstanding",
            {
              facilityId: order.destinationStockLocation.facilityId,
              stockLocationId: order.destinationStockLocationId,
            },
            "Đã hủy phần hàng thiếu qua ngày",
            `Đơn ${order.code} đã đóng phần thiếu; tiền hàng tính theo số thực nhận.`,
            "FulfillmentOrder",
            order.id,
          );
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
  }

  async settleReturns(now: Date) {
    const documents = await this.db.returnDocument.findMany({
      where: { status: "APPROVED", postedAt: null, settleAt: { lte: now } },
      take: 100,
      orderBy: [{ settleAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    for (const candidate of documents)
      await this.db.$transaction(
        async (tx) => {
          const doc = await tx.returnDocument.findUniqueOrThrow({
            where: { id: candidate.id },
            include: { order: true, lines: { include: { orderLine: true } } },
          });
          if (
            doc.postedAt ||
            doc.status !== "APPROVED" ||
            !doc.settleAt ||
            doc.settleAt > now
          )
            return;
          for (const line of doc.lines) {
            await this.movement(
              tx,
              doc.order.destinationStockLocationId,
              line.orderLine.ingredientId,
              line.quantity.neg(),
              "ADJUSTMENT",
              "ReturnDocument",
              doc.id,
              line.id,
              doc.approvedById,
            );
            if (doc.order.sourceStockLocationId)
              await this.movement(
                tx,
                doc.order.sourceStockLocationId,
                line.orderLine.ingredientId,
                line.quantity,
                "ADJUSTMENT",
                "ReturnDocument",
                doc.id,
                line.id,
                doc.approvedById,
              );
            await tx.fulfillmentLine.update({
              where: { id: line.orderLineId },
              data: {
                returnedQuantity: { increment: line.quantity },
                version: { increment: 1 },
              },
            });
          }
          await tx.returnDocument.update({
            where: { id: doc.id },
            data: { postedAt: now, version: { increment: 1 } },
          });
          await tx.fulfillmentOrder.update({
            where: { id: doc.orderId },
            data: { version: { increment: 1 } },
          });
          await this.reconcile(tx, doc.orderId);
          await tx.auditEvent.create({
            data: {
              organizationId: doc.order.organizationId,
              actorId: doc.approvedById,
              action: "return.post",
              resourceType: "ReturnDocument",
              resourceId: doc.id,
              requestId: `return:${doc.id}`,
              afterData: { posted: true, order_id: doc.orderId },
            },
          });
          await tx.notification.create({
            data: {
              organizationId: doc.order.organizationId,
              userId: doc.createdById,
              title: "Đã ghi nhận hoàn hàng",
              message: `Phiếu ${doc.code} đã cập nhật tồn kho và hóa đơn.`,
              resourceType: "ReturnDocument",
              resourceId: doc.id,
              lastRemindedAt: new Date(0),
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
  }

  async remind(now: Date) {
    const cutoff = new Date(now.getTime() - 3_600_000);
    const notifications = await this.db.notification.findMany({
      where: {
        status: "UNREAD",
        lastRemindedAt: { lte: cutoff },
        user: { active: true },
      },
      orderBy: [{ lastRemindedAt: "asc" }, { id: "asc" }],
      take: 100,
    });
    for (const notification of notifications) {
      const claimed = await this.db.notification.updateMany({
        where: {
          id: notification.id,
          status: "UNREAD",
          lastRemindedAt: notification.lastRemindedAt,
        },
        data: { lastRemindedAt: now },
      });
      if (claimed.count !== 1) continue;
      const current = await this.db.notification.findFirst({
        where: { id: notification.id, status: "UNREAD" },
      });
      if (current) await this.push.sendNotifications([current]);
    }
  }

  async dueNotifications(now: Date) {
    const soon = new Date(now.getTime() + 3_600_000);
    let transferCursor: string | undefined;
    while (true) {
      const transfers = await this.db.transfer.findMany({
        where: {
          ...(transferCursor ? { id: { gt: transferCursor } } : {}),
          status: "APPROVED",
          expectedArrivalAt: { lte: soon },
          expectedArrivalEndAt: { gte: now },
          orders: { some: { status: { in: ["RELEASED", "PARTIAL"] } } },
        },
        orderBy: { id: "asc" },
        take: 100,
        include: { toStockLocation: true },
      });
      for (const transfer of transfers)
        await this.db.$transaction(
          async (tx) => {
            const title = "Điều chuyển sắp đến giờ nhận";
            if (
              await tx.notification.count({
                where: {
                  resourceType: "Transfer",
                  resourceId: transfer.id,
                  title,
                },
              })
            )
              return;
            await notifyPermission(
              tx,
              transfer.organizationId,
              "receipt.create",
              {
                facilityId: transfer.toStockLocation.facilityId,
                stockLocationId: transfer.toStockLocationId,
              },
              title,
              `Phiếu ${transfer.code}: chuẩn bị kiểm đếm và chụp ảnh nhận hàng.`,
              "Transfer",
              transfer.id,
            );
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      if (transfers.length < 100) break;
      transferCursor = transfers[transfers.length - 1]!.id;
    }
    let orderCursor: string | undefined;
    while (true) {
      const orders = await this.db.fulfillmentOrder.findMany({
        where: {
          ...(orderCursor ? { id: { gt: orderCursor } } : {}),
          paymentDueAt: { lte: new Date(now.getTime() + 86_400_000) },
          status: { not: "CANCELLED" },
        },
        orderBy: { id: "asc" },
        take: 100,
        include: {
          destinationStockLocation: true,
          lines: true,
          paymentTracking: true,
        },
      });
      for (const order of orders) {
        const value = paymentValue(order.lines);
        if (value === null || value.lte(order.paymentTracking?.paidValue ?? 0))
          continue;
        const title =
          order.paymentDueAt! <= now
            ? "Thanh toán quá hạn"
            : "Thanh toán sắp đến hạn";
        await this.db.$transaction(
          async (tx) => {
            if (
              await tx.notification.count({
                where: {
                  resourceType: "FulfillmentOrder",
                  resourceId: order.id,
                  title,
                },
              })
            )
              return;
            await notifyPermission(
              tx,
              order.organizationId,
              "payment_tracking.update",
              {
                facilityId: order.destinationStockLocation.facilityId,
                stockLocationId: order.destinationStockLocationId,
              },
              title,
              `Đơn ${order.code} còn tiền hàng cần thanh toán.`,
              "FulfillmentOrder",
              order.id,
            );
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      }
      if (orders.length < 100) break;
      orderCursor = orders[orders.length - 1]!.id;
    }
  }

  async expireImages(now: Date) {
    const deletedFiles = await this.db.outboxEvent.findMany({
      where: { type: "ATTACHMENT_PURGE", status: "PENDING" },
      take: 100,
      orderBy: { createdAt: "asc" },
    });
    for (const event of deletedFiles) {
      const key = (event.payload as { object_key?: string }).object_key;
      if (key) await this.storage.delete(key);
      await this.db.outboxEvent.update({
        where: { id: event.id },
        data: { status: "COMPLETED", processedAt: now },
      });
    }
    const organizations = await this.db.organization.findMany({
      select: { id: true, attachmentRetentionMonths: true },
    });
    for (const organization of organizations) {
      const before = new Date(now);
      before.setUTCMonth(
        before.getUTCMonth() - organization.attachmentRetentionMonths,
      );
      const images = await this.db.attachment.findMany({
        where: {
          organizationId: organization.id,
          OR: [
            { uploadStatus: "READY", createdAt: { lt: before } },
            { uploadStatus: "PENDING", uploadExpiresAt: { lt: now } },
          ],
        },
        take: 100,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      for (const attachment of images) {
        if (attachment.objectKey)
          await this.storage.delete(attachment.objectKey);
        await this.db.attachment.delete({ where: { id: attachment.id } });
      }
    }
  }

  private async movement(
    tx: Prisma.TransactionClient,
    stockLocationId: string,
    ingredientId: string,
    quantity: Prisma.Decimal,
    entryType: "DAMAGE" | "ADJUSTMENT",
    sourceType: string,
    sourceId: string,
    sourceLineId: string,
    actor: string | null,
  ) {
    // System postings retain a stable actor UUID when no human action triggers midnight settlement.
    const postedById = actor ?? "00000000-0000-0000-0000-000000000000";
    await tx.stockLedgerEntry.create({
      data: {
        stockLocationId,
        ingredientId,
        quantity,
        entryType,
        sourceType,
        sourceId,
        sourceLineId,
        postedById,
        postingKey: `${sourceType}:${sourceLineId}:${stockLocationId}`,
      },
    });
    await tx.stockBalance.upsert({
      where: {
        stockLocationId_ingredientId: { stockLocationId, ingredientId },
      },
      create: { stockLocationId, ingredientId, quantity },
      update: { quantity: { increment: quantity }, version: { increment: 1 } },
    });
  }
  private async reconcile(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.fulfillmentOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { lines: true, paymentTracking: true },
    });
    const value = paymentValue(order.lines);
    if (value !== null && order.paymentTracking)
      await tx.paymentTracking.update({
        where: { orderId },
        data: {
          reconciledValue: value,
          status: paymentStatus(order.paymentTracking.paidValue, value),
          version: { increment: 1 },
        },
      });
  }
}
