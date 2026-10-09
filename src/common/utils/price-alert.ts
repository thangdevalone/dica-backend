import type { Prisma } from "../../generated/prisma/client.js";
import { Prisma as Types } from "../../generated/prisma/client.js";
import type { AuthUser } from "../../auth/auth.types.js";
import { notifyPermission } from "./notify.js";

export async function alertSupplierPrice(
  tx: Prisma.TransactionClient,
  user: AuthUser,
  ingredientId: string,
  supplierId: string,
  value: string,
) {
  const rule = await tx.priceRule.findUnique({
    where: {
      organizationId_ingredientId: {
        organizationId: user.organizationId,
        ingredientId,
      },
    },
  });
  const price = new Types.Decimal(value);
  if (
    rule &&
    price
      .sub(rule.basePrice)
      .abs()
      .mul(100)
      .gt(rule.basePrice.mul(rule.tolerancePercent))
  )
    await notifyPermission(
      tx,
      user.organizationId,
      "price_alert.read",
      {},
      "Giá nhà cung cấp vượt ngưỡng",
      `Nguyên liệu ${ingredientId}: giá ${price}, giá chuẩn ${rule.basePrice}, ngưỡng ${rule.tolerancePercent}%.`,
      "Supplier",
      supplierId,
    );
}
