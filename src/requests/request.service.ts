import { randomUUID } from "node:crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import type { AuthUser } from "../auth/auth.types.js";
import { ScopeService } from "../auth/scope.service.js";
import type { PaginationDto } from "../common/dto/pagination.dto.js";
import { ApiException } from "../common/errors/api.exception.js";
import { ErrorCode } from "../common/errors/error-codes.js";
import { IdempotencyService } from "../common/idempotency/idempotency.service.js";
import {
  normalizedSearch,
  paginateById,
} from "../common/pagination/pagination.js";
import { assertPositiveDecimal } from "../common/utils/decimal.js";
import { PrismaService } from "../database/prisma.service.js";
import {
  ApprovalDecision,
  DocumentStatus,
  OrderSourceType,
  Prisma,
  SourceType,
} from "../generated/prisma/client.js";
import type {
  CancelRequestDto,
  CreateRequestDto,
  CreateRequestLineDto,
  RejectRequestDto,
  RequestListQueryDto,
  UpdateRequestDto,
  VersionCommandDto,
} from "./request.dto.js";
@Injectable()
export class RequestService {
  constructor(
    private db: PrismaService,
    private scope: ScopeService,
    private idem: IdempotencyService,
  ) {}
  async list(u: AuthUser, q: RequestListQueryDto) {
    const access = this.scope.constraintsFor(u, "request.read", [
      "facilityId",
      "departmentId",
      "createdById",
    ]);
    const search = normalizedSearch(q);
    const where: Prisma.SupplyRequestWhereInput = {
      organizationId: u.organizationId,
      ...(q.status ? { status: q.status } : {}),
      ...(q.facility_id ? { facilityId: q.facility_id } : {}),
      ...(access
        ? {
            OR: access.map((item) => ({
              ...(item.facilityId ? { facilityId: item.facilityId } : {}),
              ...(item.departmentId ? { departmentId: item.departmentId } : {}),
              ...(item.createdById ? { createdById: item.createdById } : {}),
            })),
          }
        : {}),
      ...(search
        ? {
            AND: [
              {
                OR: [
                  { code: { contains: search, mode: "insensitive" as const } },
                  { note: { contains: search, mode: "insensitive" as const } },
                ],
              },
            ],
          }
        : {}),
    };
    const { data, meta } = await paginateById(
      q,
      ({ skip, take, cursorId }) =>
        this.db.supplyRequest.findMany({
          where,
          include: {
            facility: true,
            department: true,
            createdBy: { select: { id: true, displayName: true } },
            _count: { select: { lines: true, orders: true } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.supplyRequest.count({ where }),
      { searchHandled: true },
    );
    return {
      data,
      message: "Lấy danh sách yêu cầu hàng thành công.",
      meta,
    };
  }
  async detail(u: AuthUser, id: string) {
    const r = await this.db.supplyRequest.findFirst({
      where: { id, organizationId: u.organizationId },
      include: {
        facility: true,
        department: { include: { stockLocation: true } },
        createdBy: { select: { id: true, username: true, displayName: true } },
        lines: { include: { ingredient: { include: { baseUnit: true } } } },
        approvals: true,
        orders: { include: { lines: true } },
      },
    });
    if (!r) this.notFound();
    this.scope.assertAccess(u, "request.read", {
      facilityId: r.facilityId,
      departmentId: r.departmentId,
      createdById: r.createdById,
    });
    return { data: r, message: "Lấy chi tiết yêu cầu hàng thành công." };
  }
  async create(u: AuthUser, d: CreateRequestDto) {
    this.scope.assertAccess(u, "request.create", {
      facilityId: d.facility_id,
      departmentId: d.department_id,
      createdById: u.id,
    });
    if (new Set(d.lines.map((x) => x.ingredient_id)).size !== d.lines.length)
      this.invalid("Một nguyên liệu chỉ được xuất hiện một lần.");
    const dep = await this.db.department.findFirst({
      where: {
        id: d.department_id,
        facilityId: d.facility_id,
        active: true,
        facility: { organizationId: u.organizationId, active: true },
      },
    });
    if (!dep?.stockLocationId)
      this.invalid("Bộ phận nhận chưa được cấu hình kho.");
    const lines = await this.prepareLines(
      u,
      d.facility_id,
      d.department_id,
      d.lines,
      this.db,
    );
    const data = await this.db.supplyRequest.create({
      data: {
        organizationId: u.organizationId,
        facilityId: d.facility_id,
        departmentId: d.department_id,
        createdById: u.id,
        code: this.code("REQ"),
        requiredDate: new Date(d.required_date),
        ...(d.note ? { note: d.note } : {}),
        lines: { create: lines },
      },
      include: { lines: true },
    });
    return { data, message: "Tạo bản nháp yêu cầu hàng thành công." };
  }

  async updateDraft(u: AuthUser, id: string, d: UpdateRequestDto) {
    return this.replaceDraft(
      u,
      id,
      d,
      DocumentStatus.DRAFT,
      "request.update_draft",
      "Cập nhật bản nháp yêu cầu hàng thành công.",
    );
  }

  async revise(u: AuthUser, id: string, d: UpdateRequestDto) {
    return this.replaceDraft(
      u,
      id,
      d,
      DocumentStatus.REJECTED,
      "request.revise",
      "Tạo revision mới từ yêu cầu bị từ chối thành công.",
    );
  }

  async cancel(u: AuthUser, id: string, d: CancelRequestDto) {
    const data = await this.db.$transaction(
      async (tx) => {
        const request = await tx.supplyRequest.findFirst({
          where: { id, organizationId: u.organizationId },
        });
        if (!request) this.notFound();
        this.scope.assertAccess(u, "request.cancel", {
          facilityId: request.facilityId,
          departmentId: request.departmentId,
          createdById: request.createdById,
        });
        if (request.version !== d.expected_version) this.version();
        if (
          request.status !== DocumentStatus.DRAFT &&
          request.status !== DocumentStatus.SUBMITTED &&
          request.status !== DocumentStatus.REJECTED
        )
          this.invalidState(request.status);
        const guard = await tx.supplyRequest.updateMany({
          where: {
            id,
            version: d.expected_version,
            status: request.status,
          },
          data: {
            status: DocumentStatus.CANCELLED,
            decidedAt: new Date(),
            version: { increment: 1 },
          },
        });
        if (guard.count !== 1) this.version();
        const updated = await tx.supplyRequest.findUniqueOrThrow({
          where: { id },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: u.organizationId,
            actorId: u.id,
            action: "request.cancel",
            resourceType: "SupplyRequest",
            resourceId: id,
            requestId: u.requestId,
            beforeData: { status: request.status, version: request.version },
            afterData: {
              status: updated.status,
              version: updated.version,
              reason: d.note,
            },
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return { data, message: "Hủy yêu cầu hàng thành công." };
  }

  async refreshRouting(u: AuthUser, id: string, d: VersionCommandDto) {
    const data = await this.db.$transaction(
      async (tx) => {
        const request = await tx.supplyRequest.findFirst({
          where: { id, organizationId: u.organizationId },
          include: { lines: true },
        });
        if (!request) this.notFound();
        this.scope.assertAccess(u, "request.update_draft", {
          facilityId: request.facilityId,
          departmentId: request.departmentId,
          createdById: request.createdById,
        });
        if (request.version !== d.expected_version) this.version();
        if (
          request.status !== DocumentStatus.DRAFT &&
          request.status !== DocumentStatus.SUBMITTED
        )
          this.invalidState(request.status);
        const snapshots = await this.routingSnapshots(
          u,
          request.facilityId,
          request.departmentId,
          request.lines,
          tx,
        );
        await Promise.all(
          snapshots.map((snapshot) =>
            tx.requestLine.update({
              where: { id: snapshot.id },
              data: snapshot.data,
            }),
          ),
        );
        const guard = await tx.supplyRequest.updateMany({
          where: {
            id,
            version: d.expected_version,
            status: request.status,
          },
          data: {
            status: DocumentStatus.DRAFT,
            submittedAt: null,
            decidedAt: null,
            version: { increment: 1 },
          },
        });
        if (guard.count !== 1) this.version();
        const updated = await tx.supplyRequest.findUniqueOrThrow({
          where: { id },
          include: { lines: true },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: u.organizationId,
            actorId: u.id,
            action: "request.refresh_routing",
            resourceType: "SupplyRequest",
            resourceId: id,
            requestId: u.requestId,
            beforeData: { status: request.status, version: request.version },
            afterData: { status: updated.status, version: updated.version },
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return {
      data,
      message:
        "Làm mới nguồn cấp và quy đổi thành công; phiếu đã về bản nháp để gửi lại.",
    };
  }
  async submit(u: AuthUser, id: string, d: VersionCommandDto) {
    const data = await this.db.$transaction(
      async (tx) => {
        const r = await tx.supplyRequest.findFirst({
          where: { id, organizationId: u.organizationId },
          include: { lines: true },
        });
        if (!r) this.notFound();
        this.scope.assertAccess(u, "request.submit", {
          facilityId: r.facilityId,
          departmentId: r.departmentId,
          createdById: r.createdById,
        });
        this.state(
          r.status,
          r.version,
          DocumentStatus.DRAFT,
          d.expected_version,
        );
        const snapshots = await this.routingSnapshots(
          u,
          r.facilityId,
          r.departmentId,
          r.lines,
          tx,
        );
        await Promise.all(
          snapshots.map((snapshot) =>
            tx.requestLine.update({
              where: { id: snapshot.id },
              data: snapshot.data,
            }),
          ),
        );
        const guard = await tx.supplyRequest.updateMany({
          where: {
            id,
            status: DocumentStatus.DRAFT,
            version: d.expected_version,
          },
          data: {
            status: DocumentStatus.SUBMITTED,
            submittedAt: new Date(),
            version: { increment: 1 },
          },
        });
        if (guard.count !== 1) this.version();
        const submitted = await tx.supplyRequest.findUniqueOrThrow({
          where: { id },
        });
        await tx.outboxEvent.create({
          data: {
            type: "REQUEST_SUBMITTED",
            aggregateType: "SupplyRequest",
            aggregateId: id,
            payload: { request_id: id },
          },
        });
        return submitted;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return { data, message: "Gửi yêu cầu hàng chờ duyệt thành công." };
  }
  async approve(u: AuthUser, id: string, d: VersionCommandDto, raw?: string) {
    const key = this.idem.requireKey(raw);
    const out = await this.idem.execute(
      u,
      `request.approve:${id}`,
      key,
      d,
      async (tx) => {
        const r = await tx.supplyRequest.findFirst({
          where: { id, organizationId: u.organizationId },
          include: {
            lines: { include: { ingredient: true } },
            department: true,
          },
        });
        if (!r) this.notFound();
        this.scope.assertAccess(u, "request.approve", {
          facilityId: r.facilityId,
          departmentId: r.departmentId,
        });
        this.state(
          r.status,
          r.version,
          DocumentStatus.SUBMITTED,
          d.expected_version,
        );
        if (!r.department.stockLocationId)
          this.invalid("Bộ phận nhận chưa có kho.");
        const ingredientIds = r.lines.map((line) => line.ingredientId);
        const [currentRules, currentEligibilities, supplierPrices] =
          await Promise.all([
            tx.sourceRule.findMany({
              where: {
                facilityId: r.facilityId,
                ingredientId: { in: ingredientIds },
              },
            }),
            tx.itemEligibility.findMany({
              where: {
                facilityId: r.facilityId,
                departmentId: r.departmentId,
                ingredientId: { in: ingredientIds },
                active: true,
              },
              select: { ingredientId: true },
            }),
            tx.supplierIngredient.findMany({
              where: {
                supplierId: {
                  in: r.lines.flatMap((line) =>
                    line.supplierId ? [line.supplierId] : [],
                  ),
                },
                ingredientId: { in: ingredientIds },
              },
            }),
          ]);
        const ruleByIngredient = new Map(
          currentRules.map((rule) => [rule.ingredientId, rule]),
        );
        const eligibleIngredients = new Set(
          currentEligibilities.map((item) => item.ingredientId),
        );
        const priceBySupplierAndIngredient = new Map(
          supplierPrices.map((price) => [
            `${price.supplierId}:${price.ingredientId}`,
            price.referencePrice,
          ]),
        );
        for (const line of r.lines) {
          const current = ruleByIngredient.get(line.ingredientId);
          if (
            !current ||
            current.revision !== line.sourceRuleRevision ||
            !eligibleIngredients.has(line.ingredientId)
          )
            throw new ApiException(
              ErrorCode.VERSION_CONFLICT,
              "Nguồn cấp hoặc quyền xin hàng đã thay đổi. Hãy gửi lại phiếu.",
              HttpStatus.CONFLICT,
              { line_id: line.id },
            );
        }
        const groups = new Map<string, typeof r.lines>();
        for (const l of r.lines) {
          const k =
            l.sourceTypeSnapshot === SourceType.STOCK
              ? `STOCK:${l.sourceStockLocationId}`
              : `SUPPLIER:${l.supplierId}`;
          groups.set(k, [...(groups.get(k) ?? []), l]);
        }
        const orders = [];
        for (const [k, lines] of groups) {
          const [type, source] = k.split(":") as [SourceType, string];
          const o = await tx.fulfillmentOrder.create({
            data: {
              organizationId: u.organizationId,
              requestId: u.requestId,
              code: this.code("ORD"),
              sourceType:
                type === SourceType.STOCK
                  ? OrderSourceType.STOCK
                  : OrderSourceType.SUPPLIER,
              ...(type === SourceType.STOCK
                ? { sourceStockLocationId: source }
                : { supplierId: source }),
              destinationStockLocationId: r.department.stockLocationId,
              releasedAt: new Date(),
              lines: {
                create: lines.map((l) => ({
                  requestLineId: l.id,
                  ingredientId: l.ingredientId,
                  approvedQuantity: l.baseQuantity,
                  unitCodeSnapshot: l.unitCodeSnapshot,
                  unitPriceSnapshot:
                    type === SourceType.SUPPLIER
                      ? (priceBySupplierAndIngredient.get(
                          `${source}:${l.ingredientId}`,
                        ) ?? null)
                      : null,
                })),
              },
            },
          });
          orders.push({ id: o.id, code: o.code });
        }
        await tx.approvalEvent.create({
          data: {
            requestId: u.requestId,
            actorId: u.id,
            decision: ApprovalDecision.APPROVED,
            policy: "MANAGER_APPROVAL",
            ...(d.note ? { note: d.note } : {}),
          },
        });
        await tx.supplyRequest.update({
          where: { id },
          data: {
            status: DocumentStatus.APPROVED,
            decidedAt: new Date(),
            version: { increment: 1 },
          },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: u.organizationId,
            actorId: u.id,
            action: "request.approve",
            resourceType: "SupplyRequest",
            resourceId: id,
            requestId: u.requestId,
            beforeData: { status: "SUBMITTED" },
            afterData: { status: "APPROVED", orders },
          },
        });
        await tx.outboxEvent.create({
          data: {
            type: "REQUEST_APPROVED",
            aggregateType: "SupplyRequest",
            aggregateId: id,
            payload: { order_ids: orders.map((x) => x.id) },
          },
        });
        return {
          request_id: id,
          status: "APPROVED",
          orders,
        } as Prisma.JsonObject;
      },
    );
    return {
      data: out.value,
      message: out.replayed
        ? "Yêu cầu đã được duyệt trước đó; trả lại kết quả cũ."
        : "Duyệt yêu cầu và phát hành đơn thành công.",
    };
  }
  async reject(u: AuthUser, id: string, d: RejectRequestDto) {
    const data = await this.db.$transaction(
      async (tx) => {
        const r = await tx.supplyRequest.findFirst({
          where: { id, organizationId: u.organizationId },
        });
        if (!r) this.notFound();
        this.scope.assertAccess(u, "request.reject", {
          facilityId: r.facilityId,
          departmentId: r.departmentId,
        });
        this.state(
          r.status,
          r.version,
          DocumentStatus.SUBMITTED,
          d.expected_version,
        );
        const guard = await tx.supplyRequest.updateMany({
          where: {
            id,
            status: DocumentStatus.SUBMITTED,
            version: d.expected_version,
          },
          data: {
            status: DocumentStatus.REJECTED,
            decidedAt: new Date(),
            version: { increment: 1 },
          },
        });
        if (guard.count !== 1) this.version();
        await tx.approvalEvent.create({
          data: {
            requestId: u.requestId,
            actorId: u.id,
            decision: ApprovalDecision.REJECTED,
            policy: "MANAGER_APPROVAL",
            note: d.note,
          },
        });
        return tx.supplyRequest.findUniqueOrThrow({ where: { id } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return { data, message: "Từ chối yêu cầu hàng thành công." };
  }

  private async replaceDraft(
    u: AuthUser,
    id: string,
    d: UpdateRequestDto,
    expectedStatus: DocumentStatus,
    permission: string,
    message: string,
  ) {
    const data = await this.db.$transaction(
      async (tx) => {
        const request = await tx.supplyRequest.findFirst({
          where: { id, organizationId: u.organizationId },
        });
        if (!request) this.notFound();
        this.scope.assertAccess(u, permission, {
          facilityId: request.facilityId,
          departmentId: request.departmentId,
          createdById: request.createdById,
        });
        this.scope.assertAccess(u, permission, {
          facilityId: d.facility_id,
          departmentId: d.department_id,
          createdById: request.createdById,
        });
        this.state(
          request.status,
          request.version,
          expectedStatus,
          d.expected_version,
        );
        if (
          new Set(d.lines.map((line) => line.ingredient_id)).size !==
          d.lines.length
        )
          this.invalid("Một nguyên liệu chỉ được xuất hiện một lần.");
        const department = await tx.department.findFirst({
          where: {
            id: d.department_id,
            facilityId: d.facility_id,
            active: true,
            facility: { organizationId: u.organizationId, active: true },
          },
        });
        if (!department?.stockLocationId)
          this.invalid("Bộ phận nhận chưa được cấu hình kho.");
        const preparedLines = await this.prepareLines(
          u,
          d.facility_id,
          d.department_id,
          d.lines,
          tx,
        );
        const lines = preparedLines.map((line) => ({ requestId: id, ...line }));
        const guard = await tx.supplyRequest.updateMany({
          where: {
            id,
            version: d.expected_version,
            status: expectedStatus,
          },
          data: {
            facilityId: d.facility_id,
            departmentId: d.department_id,
            requiredDate: new Date(d.required_date),
            note: d.note ?? null,
            status: DocumentStatus.DRAFT,
            submittedAt: null,
            decidedAt: null,
            version: { increment: 1 },
          },
        });
        if (guard.count !== 1) this.version();
        await tx.requestLine.deleteMany({ where: { requestId: id } });
        await tx.requestLine.createMany({ data: lines });
        const updated = await tx.supplyRequest.findUniqueOrThrow({
          where: { id },
          include: { lines: true },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: u.organizationId,
            actorId: u.id,
            action:
              expectedStatus === DocumentStatus.REJECTED
                ? "request.revise"
                : "request.update_draft",
            resourceType: "SupplyRequest",
            resourceId: id,
            requestId: u.requestId,
            beforeData: {
              status: request.status,
              version: request.version,
              facility_id: request.facilityId,
              department_id: request.departmentId,
            },
            afterData: {
              status: updated.status,
              version: updated.version,
              facility_id: updated.facilityId,
              department_id: updated.departmentId,
            },
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return { data, message };
  }

  private async prepareLines(
    user: AuthUser,
    facilityId: string,
    departmentId: string,
    requestedLines: CreateRequestLineDto[],
    tx: Prisma.TransactionClient | PrismaService,
  ) {
    requestedLines.forEach((line) => assertPositiveDecimal(line.quantity));
    const ingredientIds = requestedLines.map((line) => line.ingredient_id);
    const unitIds = [...new Set(requestedLines.map((line) => line.unit_id))];
    const now = new Date();
    const [eligibilities, units, conversions] = await Promise.all([
      tx.itemEligibility.findMany({
        where: {
          facilityId,
          departmentId,
          ingredientId: { in: ingredientIds },
          active: true,
          ingredient: { organizationId: user.organizationId, active: true },
        },
        include: { ingredient: true },
      }),
      tx.unit.findMany({
        where: {
          id: { in: unitIds },
          organizationId: user.organizationId,
          active: true,
        },
      }),
      tx.ingredientUnitConversion.findMany({
        where: {
          ingredientId: { in: ingredientIds },
          unitId: { in: unitIds },
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        },
        orderBy: { version: "desc" },
      }),
    ]);
    const eligibilityByIngredient = new Map(
      eligibilities.map((item) => [item.ingredientId, item]),
    );
    const unitById = new Map(units.map((unit) => [unit.id, unit]));
    const conversionByPair = new Map<string, (typeof conversions)[number]>();
    for (const conversion of conversions) {
      const key = `${conversion.ingredientId}:${conversion.unitId}`;
      if (!conversionByPair.has(key)) conversionByPair.set(key, conversion);
    }
    return requestedLines.map((line) => {
      const eligibility = eligibilityByIngredient.get(line.ingredient_id);
      if (!eligibility)
        throw new ApiException(
          ErrorCode.VALIDATION_ERROR,
          "Nguyên liệu không được phép xin tại bộ phận.",
          HttpStatus.UNPROCESSABLE_ENTITY,
          { ingredient_id: line.ingredient_id },
        );
      const unit = unitById.get(line.unit_id);
      if (!unit) this.invalid("Đơn vị không tồn tại hoặc khác tổ chức.");
      const factor =
        line.unit_id === eligibility.ingredient.baseUnitId
          ? new Prisma.Decimal(1)
          : conversionByPair.get(`${line.ingredient_id}:${line.unit_id}`)
              ?.factorToBase;
      if (!factor) this.invalid("Chưa có quy đổi cho đơn vị đã chọn.");
      const baseQuantity = new Prisma.Decimal(line.quantity).mul(factor);
      if (
        eligibility.maxQuantityPerRequest &&
        baseQuantity.gt(eligibility.maxQuantityPerRequest)
      )
        throw new ApiException(
          ErrorCode.VALIDATION_ERROR,
          "Số lượng yêu cầu vượt giới hạn đã cấu hình.",
          HttpStatus.UNPROCESSABLE_ENTITY,
          {
            ingredient_id: line.ingredient_id,
            max_quantity_per_request:
              eligibility.maxQuantityPerRequest.toString(),
            base_unit_id: eligibility.ingredient.baseUnitId,
          },
        );
      return {
        ingredientId: line.ingredient_id,
        requestedUnitId: line.unit_id,
        requestedQuantity: line.quantity,
        baseQuantity,
        ingredientNameSnapshot: eligibility.ingredient.name,
        unitCodeSnapshot: unit.code,
        conversionFactorSnapshot: factor,
      };
    });
  }

  private async routingSnapshots(
    user: AuthUser,
    facilityId: string,
    departmentId: string,
    lines: Array<{
      id: string;
      ingredientId: string;
      requestedUnitId: string;
      requestedQuantity: Prisma.Decimal;
    }>,
    tx: Prisma.TransactionClient,
  ) {
    const ingredientIds = lines.map((line) => line.ingredientId);
    const [prepared, rules] = await Promise.all([
      this.prepareLines(
        user,
        facilityId,
        departmentId,
        lines.map((line) => ({
          ingredient_id: line.ingredientId,
          unit_id: line.requestedUnitId,
          quantity: line.requestedQuantity.toString(),
        })),
        tx,
      ),
      tx.sourceRule.findMany({
        where: { facilityId, ingredientId: { in: ingredientIds } },
        include: { supplier: true, sourceStockLocation: true },
      }),
    ]);
    const ruleByIngredient = new Map(
      rules.map((rule) => [rule.ingredientId, rule]),
    );
    return lines.map((line, index) => {
      const rule = ruleByIngredient.get(line.ingredientId);
      if (!rule?.active)
        throw new ApiException(
          ErrorCode.SOURCE_NOT_CONFIGURED,
          "Nguyên liệu chưa được cấu hình nguồn cấp.",
          HttpStatus.UNPROCESSABLE_ENTITY,
          { line_id: line.id },
        );
      if (
        !(rule.sourceType === SourceType.STOCK
          ? rule.sourceStockLocation?.active
          : rule.supplier?.active)
      )
        throw new ApiException(
          ErrorCode.SOURCE_UNAVAILABLE,
          "Nguồn cấp đang ngừng hoạt động.",
          HttpStatus.UNPROCESSABLE_ENTITY,
          { line_id: line.id },
        );
      const snapshot = prepared[index]!;
      return {
        id: line.id,
        data: {
          baseQuantity: snapshot.baseQuantity,
          conversionFactorSnapshot: snapshot.conversionFactorSnapshot,
          unitCodeSnapshot: snapshot.unitCodeSnapshot,
          sourceTypeSnapshot: rule.sourceType,
          sourceRuleRevision: rule.revision,
          sourceStockLocationId: rule.sourceStockLocationId,
          supplierId: rule.supplierId,
        },
      };
    });
  }

  private state(a: DocumentStatus, v: number, s: DocumentStatus, e: number) {
    if (v !== e)
      throw new ApiException(
        ErrorCode.VERSION_CONFLICT,
        "Phiếu đã được cập nhật. Vui lòng tải lại.",
        HttpStatus.CONFLICT,
      );
    if (a !== s)
      throw new ApiException(
        ErrorCode.INVALID_STATE,
        `Không thể thao tác khi phiếu ở trạng thái ${a}.`,
        HttpStatus.CONFLICT,
      );
  }
  private version(): never {
    throw new ApiException(
      ErrorCode.VERSION_CONFLICT,
      "Phiếu đã được cập nhật. Vui lòng tải lại.",
      HttpStatus.CONFLICT,
    );
  }
  private invalidState(status: DocumentStatus): never {
    throw new ApiException(
      ErrorCode.INVALID_STATE,
      `Không thể thao tác khi phiếu ở trạng thái ${status}.`,
      HttpStatus.CONFLICT,
    );
  }
  private code(p: string) {
    return `${p}-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
  }
  private invalid(m: string): never {
    throw new ApiException(
      ErrorCode.VALIDATION_ERROR,
      m,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
  private notFound(): never {
    throw new ApiException(
      ErrorCode.RESOURCE_NOT_FOUND,
      "Không tìm thấy yêu cầu hàng.",
      HttpStatus.NOT_FOUND,
    );
  }
}
