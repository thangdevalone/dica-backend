import { Prisma, PaymentStatus } from "../../generated/prisma/client.js";

export function paymentValue(
  lines: Array<{
    receivedQuantity: Prisma.Decimal;
    acceptedExcessQuantity: Prisma.Decimal;
    returnedQuantity?: Prisma.Decimal;
    unitPriceSnapshot: Prisma.Decimal | null;
  }>,
) {
  if (lines.some((line) => line.unitPriceSnapshot === null)) return null;
  return lines.reduce(
    (sum, line) =>
      sum.add(
        line.receivedQuantity
          .add(line.acceptedExcessQuantity)
          .sub(line.returnedQuantity ?? 0)
          .mul(line.unitPriceSnapshot!),
      ),
    new Prisma.Decimal(0),
  );
}

export function paymentStatus(paid: Prisma.Decimal, value: Prisma.Decimal) {
  return paid.gte(value) && value.gt(0)
    ? PaymentStatus.PAID
    : paid.gt(0)
      ? PaymentStatus.PARTIAL
      : PaymentStatus.UNPAID;
}
