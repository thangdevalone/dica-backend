import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import * as argon2 from "argon2";
import {
  SYSTEM_PERMISSIONS,
  SYSTEM_ROLE_PERMISSIONS,
} from "../src/auth/access-control.catalog.js";
import {
  DepartmentType,
  FacilityType,
  LedgerEntryType,
  PrismaClient,
  ScopeType,
  SourceType,
  StockLocationType,
  UserKind,
} from "../src/generated/prisma/client.js";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env["DATABASE_URL"] }),
});
const permissions = [
  "user.read",
  "user.create",
  "user.update",
  "user.deactivate",
  "user.reset_password",
  "user.revoke_sessions",
  "role.read",
  "role.manage",
  "grant.read",
  "grant.assign",
  "grant.revoke",
  "facility.read",
  "facility.manage",
  "stock_location.read",
  "stock_location.manage",
  "department.read",
  "department.manage",
  "ingredient.read",
  "ingredient.manage",
  "ingredient_group.manage",
  "unit.read",
  "unit.manage",
  "conversion.read",
  "conversion.manage",
  "supplier.read",
  "supplier.manage",
  "supplier_ingredient.read",
  "supplier_ingredient.manage",
  "eligibility.read",
  "eligibility.manage",
  "source_rule.read",
  "source_rule.manage",
  "source_rule.bulk_update",
  "request.read",
  "request.create",
  "request.update_draft",
  "request.revise",
  "request.submit",
  "request.cancel",
  "request.approve",
  "request.reject",
  "order.read",
  "order.release",
  "order.export",
  "order.change_source",
  "order.close_outstanding",
  "order.cancel",
  "transfer.read",
  "transfer.create",
  "transfer.update_draft",
  "transfer.submit",
  "transfer.approve",
  "transfer.reject",
  "transfer.cancel",
  "dispatch.read",
  "dispatch.create",
  "dispatch.post",
  "receipt.read",
  "receipt.create",
  "receipt.post",
  "discrepancy.read",
  "discrepancy.resolve",
  "stock.read",
  "stock_ledger.read",
  "adjustment.read",
  "adjustment.create",
  "adjustment.approve",
  "adjustment.post",
  "stocktake.read",
  "stocktake.create",
  "stocktake.update_draft",
  "stocktake.submit",
  "stocktake.reopen",
  "damage.create",
  "damage.read",
  "damage.update_draft",
  "damage.submit",
  "damage.confirm",
  "variance.read",
  "variance.recalculate",
  "alert_rule.manage",
  "recipe.read",
  "recipe.manage",
  "ipos_mapping.read",
  "ipos_mapping.manage",
  "sales_import.create",
  "sales_import.read",
  "sales_import.commit",
  "payment_tracking.read",
  "payment_tracking.update",
  "report.stock",
  "report.fulfillment",
  "report.variance",
  "report.damage",
  "report.payment",
  "report.export",
  "audit.read",
  "attachment.upload",
  "notification.read_own",
  "notification.mark_own",
  "backup.manage",
  "supplier_order.read_own",
  "dashboard.read",
] as const;
const rolePermissions: Record<string, readonly string[]> = {
  ADMIN_OWNER: permissions.filter(
    (p) => p !== "backup.manage" && p !== "supplier_order.read_own",
  ),
  GENERAL_MANAGER: permissions.filter(
    (p) =>
      ![
        "role.manage",
        "grant.assign",
        "grant.revoke",
        "backup.manage",
        "supplier_order.read_own",
        "sales_import.commit",
      ].includes(p),
  ),
  BRANCH_MANAGER: [
    "facility.read",
    "stock_location.read",
    "department.read",
    "ingredient.read",
    "unit.read",
    "supplier.read",
    "eligibility.read",
    "source_rule.read",
    "request.read",
    "request.create",
    "request.update_draft",
    "request.revise",
    "request.submit",
    "request.cancel",
    "transfer.read",
    "transfer.create",
    "transfer.update_draft",
    "transfer.submit",
    "transfer.cancel",
    "order.read",
    "receipt.read",
    "receipt.create",
    "receipt.post",
    "discrepancy.read",
    "discrepancy.resolve",
    "stock.read",
    "stocktake.read",
    "stocktake.create",
    "stocktake.update_draft",
    "stocktake.submit",
    "damage.create",
    "damage.read",
    "damage.update_draft",
    "damage.submit",
    "attachment.upload",
    "notification.read_own",
    "notification.mark_own",
    "dashboard.read",
  ],
  BRANCH_STAFF: [
    "facility.read",
    "stock_location.read",
    "department.read",
    "ingredient.read",
    "unit.read",
    "eligibility.read",
    "source_rule.read",
    "request.read",
    "request.create",
    "request.update_draft",
    "request.revise",
    "request.submit",
    "request.cancel",
    "transfer.read",
    "transfer.create",
    "transfer.update_draft",
    "transfer.submit",
    "transfer.cancel",
    "order.read",
    "receipt.read",
    "receipt.create",
    "receipt.post",
    "discrepancy.read",
    "stock.read",
    "stocktake.read",
    "stocktake.create",
    "stocktake.update_draft",
    "stocktake.submit",
    "damage.create",
    "damage.read",
    "damage.update_draft",
    "damage.submit",
    "attachment.upload",
    "notification.read_own",
    "notification.mark_own",
    "dashboard.read",
  ],
  WAREHOUSE_STAFF: [
    "facility.read",
    "stock_location.read",
    "department.read",
    "ingredient.read",
    "unit.read",
    "supplier.read",
    "supplier_ingredient.read",
    "eligibility.read",
    "source_rule.read",
    "request.read",
    "request.create",
    "request.update_draft",
    "request.revise",
    "request.submit",
    "request.cancel",
    "transfer.read",
    "transfer.create",
    "transfer.update_draft",
    "transfer.submit",
    "transfer.cancel",
    "order.read",
    "dispatch.read",
    "dispatch.create",
    "dispatch.post",
    "receipt.read",
    "receipt.create",
    "receipt.post",
    "discrepancy.read",
    "stock.read",
    "stock_ledger.read",
    "stocktake.read",
    "stocktake.create",
    "stocktake.update_draft",
    "stocktake.submit",
    "damage.create",
    "damage.read",
    "damage.update_draft",
    "damage.submit",
    "attachment.upload",
    "notification.read_own",
    "notification.mark_own",
    "dashboard.read",
  ],
  SUPPLIER: [
    "supplier_order.read_own",
    "notification.read_own",
    "notification.mark_own",
  ],
};
async function main() {
  const production = process.env["NODE_ENV"] === "production";
  const suppliedPassword = process.env["SEED_ADMIN_PASSWORD"];
  if (production && (!suppliedPassword || suppliedPassword.includes("replace")))
    throw new Error(
      "Production bắt buộc cấu hình SEED_ADMIN_PASSWORD an toàn.",
    );
  const password =
    suppliedPassword && !suppliedPassword.includes("replace")
      ? suppliedPassword
      : "DicaDemo#2026";
  const org = await db.organization.upsert({
    where: { code: "DICA" },
    update: {},
    create: { code: "DICA", name: "DICA Demo" },
  });
  for (const code of SYSTEM_PERMISSIONS)
    await db.permission.upsert({
      where: { code },
      update: {},
      create: { code, description: code },
    });
  const roles: Record<string, string> = {};
  for (const [code, list] of Object.entries(SYSTEM_ROLE_PERMISSIONS)) {
    const role = await db.role.upsert({
      where: { organizationId_code: { organizationId: org.id, code } },
      update: { active: true },
      create: { organizationId: org.id, code, name: code, system: true },
    });
    roles[code] = role.id;
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    await db.rolePermission.createMany({
      data: list.map((permissionCode) => ({ roleId: role.id, permissionCode })),
      skipDuplicates: true,
    });
  }
  const kg = await db.unit.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "KG" } },
    update: {},
    create: { organizationId: org.id, code: "KG", name: "Kilôgam" },
  });
  const bag = await db.unit.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "BAG" } },
    update: {},
    create: { organizationId: org.id, code: "BAG", name: "Bao" },
  });
  const group = await db.ingredientGroup.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "FOOD" } },
    update: {},
    create: { organizationId: org.id, code: "FOOD", name: "Thực phẩm" },
  });
  const rice = await db.ingredient.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "RICE" } },
    update: {},
    create: {
      organizationId: org.id,
      groupId: group.id,
      baseUnitId: kg.id,
      code: "RICE",
      name: "Gạo",
    },
  });
  await db.ingredientUnitConversion.upsert({
    where: {
      ingredientId_unitId_version: {
        ingredientId: rice.id,
        unitId: bag.id,
        version: 1,
      },
    },
    update: {},
    create: {
      ingredientId: rice.id,
      unitId: bag.id,
      factorToBase: "25",
      version: 1,
    },
  });
  const facilities = new Map<string, { id: string }>();
  for (const f of [
    { code: "CW", name: "Kho tổng", type: FacilityType.CENTRAL_WAREHOUSE },
    { code: "CK", name: "Bếp tổng", type: FacilityType.CENTRAL_KITCHEN },
    { code: "BRA", name: "Chi nhánh A", type: FacilityType.BRANCH },
    { code: "BRB", name: "Chi nhánh B", type: FacilityType.BRANCH },
  ])
    facilities.set(
      f.code,
      await db.facility.upsert({
        where: {
          organizationId_code: { organizationId: org.id, code: f.code },
        },
        update: {},
        create: { organizationId: org.id, ...f },
      }),
    );
  const locations = new Map<string, { id: string; facilityId: string }>();
  for (const [code, name, facility, type] of [
    ["CW_MAIN", "Kho tổng", "CW", StockLocationType.PHYSICAL],
    [
      "CW_TRANSIT",
      "Hàng đang vận chuyển kho tổng",
      "CW",
      StockLocationType.IN_TRANSIT,
    ],
    ["CK_MAIN", "Kho Bếp tổng", "CK", StockLocationType.PHYSICAL],
    ["BRA_KITCHEN", "Kho Bếp A", "BRA", StockLocationType.PHYSICAL],
    ["BRA_TABLE", "Kho Bàn A", "BRA", StockLocationType.PHYSICAL],
    ["BRB_KITCHEN", "Kho Bếp B", "BRB", StockLocationType.PHYSICAL],
  ] as const) {
    const facilityId = facilities.get(facility)!.id;
    locations.set(
      code,
      await db.stockLocation.upsert({
        where: { facilityId_code: { facilityId, code } },
        update: {},
        create: { facilityId, code, name, type },
      }),
    );
  }
  const departments = [];
  for (const [code, name, facility, location, type] of [
    ["BRA_KITCHEN", "Bếp A", "BRA", "BRA_KITCHEN", DepartmentType.KITCHEN],
    ["BRA_TABLE", "Bàn A", "BRA", "BRA_TABLE", DepartmentType.TABLE],
    ["BRB_KITCHEN", "Bếp B", "BRB", "BRB_KITCHEN", DepartmentType.KITCHEN],
  ] as const)
    departments.push(
      await db.department.upsert({
        where: {
          facilityId_code: { facilityId: facilities.get(facility)!.id, code },
        },
        update: {},
        create: {
          facilityId: facilities.get(facility)!.id,
          stockLocationId: locations.get(location)!.id,
          code,
          name,
          type,
        },
      }),
    );
  const supplierA = await db.supplier.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "SUP-A" } },
    update: {},
    create: { organizationId: org.id, code: "SUP-A", name: "Nhà cung ứng A" },
  });
  const supplierB = await db.supplier.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "SUP-B" } },
    update: {},
    create: { organizationId: org.id, code: "SUP-B", name: "Nhà cung ứng B" },
  });
  await db.supplierIngredient.upsert({
    where: {
      supplierId_ingredientId: {
        supplierId: supplierA.id,
        ingredientId: rice.id,
      },
    },
    update: {},
    create: {
      supplierId: supplierA.id,
      ingredientId: rice.id,
      referencePrice: "18000",
    },
  });
  await db.supplierIngredient.upsert({
    where: {
      supplierId_ingredientId: {
        supplierId: supplierB.id,
        ingredientId: rice.id,
      },
    },
    update: {},
    create: {
      supplierId: supplierB.id,
      ingredientId: rice.id,
      referencePrice: "17500",
    },
  });
  for (const dep of departments)
    await db.itemEligibility.upsert({
      where: {
        facilityId_departmentId_ingredientId: {
          facilityId: dep.facilityId,
          departmentId: dep.id,
          ingredientId: rice.id,
        },
      },
      update: { active: true },
      create: {
        facilityId: dep.facilityId,
        departmentId: dep.id,
        ingredientId: rice.id,
      },
    });
  await db.sourceRule.upsert({
    where: {
      facilityId_ingredientId: {
        facilityId: facilities.get("BRA")!.id,
        ingredientId: rice.id,
      },
    },
    update: {},
    create: {
      facilityId: facilities.get("BRA")!.id,
      ingredientId: rice.id,
      sourceType: SourceType.STOCK,
      sourceStockLocationId: locations.get("CW_MAIN")!.id,
    },
  });
  await db.sourceRule.upsert({
    where: {
      facilityId_ingredientId: {
        facilityId: facilities.get("BRB")!.id,
        ingredientId: rice.id,
      },
    },
    update: {},
    create: {
      facilityId: facilities.get("BRB")!.id,
      ingredientId: rice.id,
      sourceType: SourceType.SUPPLIER,
      supplierId: supplierA.id,
    },
  });
  const hash = await argon2.hash(password);
  const admin = await db.user.upsert({
    where: {
      organizationId_username: {
        organizationId: org.id,
        username: process.env["SEED_ADMIN_USERNAME"] ?? "admin",
      },
    },
    update: { passwordHash: hash, active: true },
    create: {
      organizationId: org.id,
      username: process.env["SEED_ADMIN_USERNAME"] ?? "admin",
      displayName: "Quản trị DICA",
      passwordHash: hash,
    },
  });
  await db.roleGrant.deleteMany({
    where: { userId: admin.id, roleId: roles["ADMIN_OWNER"] },
  });
  await db.roleGrant.create({
    data: {
      userId: admin.id,
      roleId: roles["ADMIN_OWNER"]!,
      scopeType: ScopeType.ORGANIZATION,
    },
  });
  const supplierUser = await db.user.upsert({
    where: {
      organizationId_username: {
        organizationId: org.id,
        username: "supplier.a",
      },
    },
    update: { supplierId: supplierA.id, passwordHash: hash, active: true },
    create: {
      organizationId: org.id,
      supplierId: supplierA.id,
      kind: UserKind.SUPPLIER,
      username: "supplier.a",
      displayName: "Nhà cung ứng A",
      passwordHash: hash,
    },
  });
  await db.roleGrant.deleteMany({
    where: { userId: supplierUser.id, roleId: roles["SUPPLIER"] },
  });
  await db.roleGrant.create({
    data: {
      userId: supplierUser.id,
      roleId: roles["SUPPLIER"]!,
      scopeType: ScopeType.SUPPLIER,
    },
  });
  const initial = "1000",
    sourceId = randomUUID(),
    postingKey = "DEMO:OPENING:RICE:CW_MAIN";
  await db.stockLedgerEntry.upsert({
    where: { postingKey },
    update: {},
    create: {
      stockLocationId: locations.get("CW_MAIN")!.id,
      ingredientId: rice.id,
      entryType: LedgerEntryType.ADJUSTMENT,
      quantity: initial,
      sourceType: "SeedOpening",
      sourceId,
      sourceLineId: sourceId,
      postingKey,
      postedById: admin.id,
    },
  });
  await db.stockBalance.upsert({
    where: {
      stockLocationId_ingredientId: {
        stockLocationId: locations.get("CW_MAIN")!.id,
        ingredientId: rice.id,
      },
    },
    update: { quantity: initial },
    create: {
      stockLocationId: locations.get("CW_MAIN")!.id,
      ingredientId: rice.id,
      quantity: initial,
    },
  });
  console.log(
    "Seed demo hoàn tất. Tài khoản admin và supplier.a dùng mật khẩu SEED_ADMIN_PASSWORD (hoặc DicaDemo#2026 ở môi trường không production).",
  );
}
main().finally(() => db.$disconnect());
