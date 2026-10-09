import { HttpStatus, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import * as argon2 from "argon2";
import type { AuthUser } from "../auth/auth.types.js";
import { PrismaService } from "../database/prisma.service.js";
import { Prisma } from "../generated/prisma/client.js";
import { ApiException } from "../common/errors/api.exception.js";
import { ErrorCode } from "../common/errors/error-codes.js";

const ROOTS = {
  facility: "facilities",
  stock_location: "stock_locations",
  ingredient: "ingredients",
  supplier: "suppliers",
} as const;
export type PurgeKind = keyof typeof ROOTS;
type Edge = { child: string; parent: string; column: string };
// Removing one document line removes the complete historical document, not a broken subtotal.
const DOCUMENT_PARENTS: Record<string, [string, string]> = {
  request_lines: ["supply_requests", "request_id"],
  transfer_lines: ["transfers", "transfer_id"],
  fulfillment_lines: ["fulfillment_orders", "order_id"],
  dispatch_lines: ["dispatches", "dispatch_id"],
  receipt_lines: ["receipts", "receipt_id"],
  stocktake_lines: ["stocktakes", "stocktake_id"],
  damage_lines: ["damage_reports", "report_id"],
  return_lines: ["return_documents", "return_id"],
  recipe_ingredients: ["recipe_versions", "recipe_version_id"],
};
const RESOURCES: Record<string, string[]> = {
  facilities: ["Facility"],
  stock_locations: ["StockLocation"],
  ingredients: ["Ingredient"],
  suppliers: ["Supplier"],
  supply_requests: ["SupplyRequest"],
  transfers: ["Transfer"],
  fulfillment_orders: [
    "FulfillmentOrder",
    "OrderCancellation",
    "ShortageExpiry",
  ],
  receipts: ["Receipt", "ReceiptExcess", "RECEIPT"],
  dispatches: ["Dispatch"],
  stocktakes: ["Stocktake"],
  damage_reports: ["DamageReport", "DAMAGE_REPORT"],
  return_documents: ["ReturnDocument", "RETURN"],
  inventory_adjustments: ["InventoryAdjustment"],
};

@Injectable()
export class PurgeService {
  constructor(private readonly db: PrismaService) {}
  async preview(user: AuthUser, kind: PurgeKind, id: string) {
    this.admin(user);
    const plan = await this.db.$transaction(
      (tx) => this.plan(tx, user, kind, id),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return {
      data: this.summary(plan),
      message:
        "Xóa vĩnh viễn sẽ xóa các chứng từ và lịch sử liên quan; tồn kho được tính lại từ sổ kho còn lại.",
    };
  }
  async execute(
    user: AuthUser,
    kind: PurgeKind,
    id: string,
    password: string,
    previewHash: string,
  ) {
    this.admin(user);
    const actor = await this.db.user.findFirst({
      where: { id: user.id, organizationId: user.organizationId, active: true },
    });
    if (!actor || !(await argon2.verify(actor.passwordHash, password)))
      throw new ApiException(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        "Mật khẩu ADMIN không đúng.",
        HttpStatus.UNAUTHORIZED,
      );
    const data = await this.db.$transaction(
      async (tx) => {
        const plan = await this.plan(tx, user, kind, id);
        const summary = this.summary(plan);
        if (previewHash !== summary.previewHash)
          this.invalid(
            "Dữ liệu đã thay đổi. Xem lại phạm vi xóa trước khi xác nhận.",
          );
        const attachmentIds = [...(plan.rows.get("attachments") ?? [])];
        const attachments = await tx.attachment.findMany({
          where: { id: { in: attachmentIds } },
          select: { id: true, objectKey: true },
        });
        for (const attachment of attachments)
          if (attachment.objectKey)
            await tx.outboxEvent.create({
              data: {
                type: "ATTACHMENT_PURGE",
                aggregateType: "Attachment",
                aggregateId: attachment.id,
                payload: { object_key: attachment.objectKey },
              },
            });
        for (const table of plan.order) {
          const ids = [...plan.rows.get(table)!];
          await tx.$executeRawUnsafe(
            `DELETE FROM ${this.identifier(table)} WHERE id::text = ANY($1::text[])`,
            ids,
          );
        }
        // Existing idempotency responses can contain deleted documents or personal data.
        await tx.idempotencyRecord.deleteMany({
          where: { organizationId: user.organizationId },
        });
        await tx.$executeRaw`
        UPDATE stock_balances b SET quantity = COALESCE((SELECT SUM(l.quantity) FROM stock_ledger_entries l
          WHERE l.stock_location_id = b.stock_location_id AND l.ingredient_id = b.ingredient_id), 0), version = version + 1
        FROM stock_locations s, facilities f
        WHERE b.stock_location_id = s.id AND s.facility_id = f.id AND f.organization_id = ${user.organizationId}::uuid
      `;
        await tx.auditEvent.create({
          data: {
            organizationId: user.organizationId,
            actorId: user.id,
            action: "config.permanent_delete",
            resourceType: kind,
            resourceId: id,
            requestId: user.requestId,
            afterData: { counts: summary.counts, preview_hash: previewHash },
          },
        });
        return summary;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 60_000,
      },
    );
    return {
      data,
      message: "Đã xóa dữ liệu cùng lịch sử liên quan và tính lại tồn kho.",
    };
  }

  private async plan(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    kind: PurgeKind,
    id: string,
  ) {
    const table = ROOTS[kind];
    if (!table) this.invalid("Loại dữ liệu không được phép xóa.");
    const root =
      kind === "stock_location"
        ? await tx.stockLocation.findFirst({
            where: { id, facility: { organizationId: user.organizationId } },
            select: { name: true },
          })
        : (
            await tx.$queryRawUnsafe<{ name: string }[]>(
              `SELECT name FROM ${this.identifier(table)} WHERE id = $1::uuid AND organization_id = $2::uuid`,
              id,
              user.organizationId,
            )
          )[0];
    if (!root)
      throw new ApiException(
        ErrorCode.RESOURCE_NOT_FOUND,
        "Không tìm thấy dữ liệu.",
        HttpStatus.NOT_FOUND,
      );
    const edges = await tx.$queryRaw<Edge[]>`
      SELECT child.relname AS child, parent.relname AS parent, a.attname AS column
      FROM pg_constraint c JOIN pg_class child ON child.oid = c.conrelid
      JOIN pg_class parent ON parent.oid = c.confrelid
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      JOIN pg_attribute target ON target.attrelid = c.confrelid AND target.attnum = c.confkey[1]
      JOIN pg_namespace ns ON ns.oid = child.relnamespace
      WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1 AND target.attname = 'id' AND ns.nspname = 'public'
    `;
    const rows = new Map<string, Set<string>>([[table, new Set([id])]]);
    let changed = true;
    const add = (target: string, ids: string[]) => {
      if (!ids.length) return;
      const current = rows.get(target) ?? new Set<string>();
      for (const key of ids)
        if (!current.has(key)) {
          current.add(key);
          changed = true;
        }
      rows.set(target, current);
    };
    for (let pass = 0; changed; pass++) {
      if (
        pass > 60 ||
        [...rows.values()].reduce((sum, ids) => sum + ids.size, 0) > 50_000
      )
        this.invalid("Phạm vi xóa quá lớn; cần chia nhỏ dữ liệu.");
      changed = false;
      for (const edge of edges) {
        const ids = rows.get(edge.parent);
        if (!ids?.size) continue;
        const found = await tx.$queryRawUnsafe<{ id: string }[]>(
          `SELECT id::text AS id FROM ${this.identifier(edge.child)} WHERE ${this.identifier(edge.column)}::text = ANY($1::text[])`,
          [...ids],
        );
        add(
          edge.child,
          found.map((row) => row.id),
        );
      }
      for (const [child, [parent, column]] of Object.entries(
        DOCUMENT_PARENTS,
      )) {
        const ids = rows.get(child);
        if (!ids?.size) continue;
        const found = await tx.$queryRawUnsafe<{ id: string }[]>(
          `SELECT ${this.identifier(column)}::text AS id FROM ${this.identifier(child)} WHERE id::text = ANY($1::text[]) AND ${this.identifier(column)} IS NOT NULL`,
          [...ids],
        );
        add(
          parent,
          found.map((row) => row.id),
        );
      }
      for (const [rootTable, column] of [
        ["suppliers", "supplier_id"],
        ["stock_locations", "source_stock_location_id"],
      ] as const) {
        const ids = rows.get(rootTable);
        if (!ids?.size) continue;
        const found = await tx.$queryRawUnsafe<{ id: string }[]>(
          `SELECT id::text AS id FROM request_lines WHERE ${this.identifier(column)}::text = ANY($1::text[])`,
          [...ids],
        );
        add(
          "request_lines",
          found.map((row) => row.id),
        );
      }
      const orderIds = rows.get("fulfillment_orders");
      if (orderIds?.size) {
        const parents = await tx.fulfillmentOrder.findMany({
          where: { id: { in: [...orderIds] } },
          select: { requestId: true, transferId: true },
        });
        add(
          "supply_requests",
          parents.flatMap((row) => (row.requestId ? [row.requestId] : [])),
        );
        add(
          "transfers",
          parents.flatMap((row) => (row.transferId ? [row.transferId] : [])),
        );
      }
      for (const [resourceTable, types] of Object.entries(RESOURCES)) {
        const ids = rows.get(resourceTable);
        if (!ids?.size) continue;
        for (const [dependent, typeColumn, idColumn] of [
          ["stock_ledger_entries", "source_type", "source_id"],
          ["attachments", "resource_type", "resource_id"],
          ["audit_events", "resource_type", "resource_id"],
          ["notifications", "resource_type", "resource_id"],
          ["outbox_events", "aggregate_type", "aggregate_id"],
        ]) {
          const found = await tx.$queryRawUnsafe<{ id: string }[]>(
            `SELECT id::text AS id FROM ${this.identifier(dependent!)} WHERE ${this.identifier(typeColumn!)} = ANY($1::text[]) AND ${this.identifier(idColumn!)}::text = ANY($2::text[])`,
            types,
            [...ids],
          );
          add(
            dependent!,
            found.map((row) => row.id),
          );
        }
      }
      if (rows.has("ingredients")) {
        const found = await tx.priceRule.findMany({
          where: {
            organizationId: user.organizationId,
            ingredientId: { in: [...rows.get("ingredients")!] },
          },
          select: { id: true },
        });
        add(
          "price_rules",
          found.map((row) => row.id),
        );
      }
    }
    if (rows.get("users")?.has(user.id))
      this.invalid("Không thể xóa chính tài khoản ADMIN đang sử dụng.");
    const order: string[] = [];
    const remaining = new Set(rows.keys());
    while (remaining.size) {
      const next = [...remaining].find(
        (parent) =>
          !edges.some(
            (edge) =>
              edge.parent === parent &&
              edge.child !== parent &&
              remaining.has(edge.child),
          ),
      );
      if (!next)
        this.invalid(
          "Dữ liệu có liên kết vòng; cần xử lý liên kết trước khi xóa.",
        );
      order.push(next);
      remaining.delete(next);
    }
    return { rows, order, name: root.name, kind, id };
  }
  private summary(plan: {
    rows: Map<string, Set<string>>;
    name: string;
    kind: PurgeKind;
    id: string;
  }) {
    const entries = [...plan.rows.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([table, ids]) => [table, [...ids].sort()] as const);
    return {
      name: plan.name,
      kind: plan.kind,
      id: plan.id,
      counts: Object.fromEntries(
        entries.map(([table, ids]) => [table, ids.length]),
      ),
      previewHash: createHash("sha256")
        .update(JSON.stringify(entries))
        .digest("hex"),
    };
  }
  private admin(user: AuthUser) {
    if (
      user.kind !== "INTERNAL" ||
      !user.grants.some(
        (grant) =>
          grant.roleCode === "ADMIN_OWNER" &&
          grant.scopeType === "ORGANIZATION" &&
          grant.permissions.includes("system.purge"),
      )
    )
      throw new ApiException(
        ErrorCode.FORBIDDEN,
        "Chỉ tài khoản ADMIN config được xóa vĩnh viễn.",
        HttpStatus.FORBIDDEN,
      );
  }
  private identifier(name: string) {
    if (!/^[a-z_]+$/.test(name)) throw new Error("Invalid database identifier");
    return `"${name}"`;
  }
  private invalid(message: string): never {
    throw new ApiException(
      ErrorCode.VALIDATION_ERROR,
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
