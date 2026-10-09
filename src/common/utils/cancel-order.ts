import { HttpStatus } from "@nestjs/common";
import type { AuthUser } from "../../auth/auth.types.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { ApiException } from "../errors/api.exception.js";
import { ErrorCode } from "../errors/error-codes.js";

// Must run in the caller's Serializable transaction with its document authorization.
export async function cancelUnreceivedOrder(
  tx: Prisma.TransactionClient,
  user: AuthUser,
  id: string,
  note: string,
) {
  const order = await tx.fulfillmentOrder.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      receipts: true,
      dispatches: { include: { lines: { include: { orderLine: true } } } },
      sourceStockLocation: true,
    },
  });
  if (
    !order ||
    !["RELEASED", "PARTIAL"].includes(order.status) ||
    order.receipts.some((receipt) => receipt.status === "POSTED")
  )
    throw new ApiException(
      ErrorCode.INVALID_STATE,
      "Chỉ được hủy đơn chưa nhận hàng. Muốn thay đổi phải lập phiếu mới.",
      HttpStatus.CONFLICT,
    );
  if (order.sourceStockLocation) {
    const transit = await tx.stockLocation.findFirst({
      where: {
        facilityId: order.sourceStockLocation.facilityId,
        type: "IN_TRANSIT",
      },
    });
    for (const dispatch of order.dispatches.filter(
      (item) => item.status === "POSTED",
    )) {
      if (!transit)
        throw new ApiException(
          ErrorCode.DATA_INCOMPLETE,
          "Thiếu kho đang vận chuyển để đảo xuất.",
          HttpStatus.CONFLICT,
        );
      for (const line of dispatch.lines) {
        for (const [locationId, quantity] of [
          [transit.id, line.quantity.neg()],
          [order.sourceStockLocationId!, line.quantity],
        ] as const) {
          await tx.stockLedgerEntry.create({
            data: {
              stockLocationId: locationId,
              ingredientId: line.orderLine.ingredientId,
              quantity,
              entryType: "REVERSAL",
              sourceType: "OrderCancellation",
              sourceId: id,
              sourceLineId: line.id,
              postingKey: `CANCEL:${line.id}:${locationId}`,
              postedById: user.id,
            },
          });
          await tx.stockBalance.upsert({
            where: {
              stockLocationId_ingredientId: {
                stockLocationId: locationId,
                ingredientId: line.orderLine.ingredientId,
              },
            },
            create: {
              stockLocationId: locationId,
              ingredientId: line.orderLine.ingredientId,
              quantity,
            },
            update: {
              quantity: { increment: quantity },
              version: { increment: 1 },
            },
          });
        }
      }
    }
  }
  await tx.dispatch.updateMany({
    where: { orderId: id, status: { in: ["DRAFT", "POSTED"] } },
    data: { status: "CANCELLED", version: { increment: 1 } },
  });
  await tx.receipt.updateMany({
    where: { orderId: id, status: "DRAFT" },
    data: { status: "CANCELLED", version: { increment: 1 } },
  });
  const updated = await tx.fulfillmentOrder.update({
    where: { id },
    data: { status: "CANCELLED", version: { increment: 1 } },
  });
  await tx.auditEvent.create({
    data: {
      organizationId: user.organizationId,
      actorId: user.id,
      action: "order.cancel",
      resourceType: "FulfillmentOrder",
      resourceId: id,
      requestId: user.requestId,
      beforeData: { status: order.status },
      afterData: { status: "CANCELLED", reason: note, dispatch_reversed: true },
    },
  });
  return updated;
}
