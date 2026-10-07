import type { OpenAPIObject } from "@nestjs/swagger";

type Schema = Record<string, unknown>;

const uuid: Schema = { type: "string", format: "uuid" };
const dateTime: Schema = { type: "string", format: "date-time" };
const date: Schema = { type: "string", format: "date" };
const decimal: Schema = {
  type: "string",
  pattern: "^-?(?:0|[1-9]\\d*)(?:\\.\\d+)?$",
  example: "5.5",
  description: "Số thập phân được serialize dưới dạng chuỗi.",
};
const nullable = (schema: Schema): Schema => ({ ...schema, nullable: true });
const ref = (name: string): Schema => ({
  $ref: `#/components/schemas/${name}`,
});
const arrayOf = (items: Schema): Schema => ({ type: "array", items });
const entity = (
  required: string[],
  properties: Record<string, Schema>,
): Schema => ({
  type: "object",
  required,
  properties,
  // Một số endpoint detail trả thêm relation tùy quyền; vẫn giữ các field lõi có type.
  additionalProperties: true,
});

const ALL_ERROR_CODES = [
  "AUTH_INVALID_CREDENTIALS",
  "AUTH_SESSION_INVALID",
  "FORBIDDEN",
  "RESOURCE_NOT_FOUND",
  "VALIDATION_ERROR",
  "INVALID_STATE",
  "VERSION_CONFLICT",
  "IDEMPOTENCY_CONFLICT",
  "IDEMPOTENCY_KEY_REQUIRED",
  "SOURCE_NOT_CONFIGURED",
  "SOURCE_UNAVAILABLE",
  "QUANTITY_EXCEEDS_REMAINING",
  "INSUFFICIENT_STOCK",
  "DATA_INCOMPLETE",
  "POLICY_NOT_CONFIGURED",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;

function errorResponseSchema(codes: readonly string[]): Schema {
  return entity(["success", "code", "message", "request_id", "timestamp"], {
    success: { type: "boolean", enum: [false] },
    code: { type: "string", enum: [...codes] },
    message: { type: "string" },
    details: {
      nullable: true,
      oneOf: [
        {
          type: "array",
          items: {
            oneOf: [
              { type: "string" },
              { type: "object", additionalProperties: true },
            ],
          },
        },
        { type: "object", additionalProperties: true },
      ],
    },
    request_id: uuid,
    timestamp: dateTime,
  });
}

const documentStatus = {
  type: "string",
  enum: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"],
};
const orderStatus = {
  type: "string",
  enum: ["DRAFT", "RELEASED", "PARTIAL", "COMPLETED", "CLOSED", "CANCELLED"],
};

export const DICA_RESPONSE_SCHEMAS: Record<string, Schema> = {
  PaginationMeta: {
    oneOf: [
      entity(
        [
          "mode",
          "page",
          "page_size",
          "total",
          "total_pages",
          "has_next",
          "has_previous",
        ],
        {
          mode: { type: "string", enum: ["offset"] },
          page: { type: "integer", minimum: 1 },
          page_size: { type: "integer", minimum: 1, maximum: 100 },
          total: { type: "integer", minimum: 0 },
          total_pages: { type: "integer", minimum: 0 },
          has_next: { type: "boolean" },
          has_previous: { type: "boolean" },
        },
      ),
      entity(["mode", "page_size", "next_cursor", "has_next"], {
        mode: { type: "string", enum: ["cursor"] },
        page_size: { type: "integer", minimum: 1, maximum: 100 },
        next_cursor: nullable(uuid),
        has_next: { type: "boolean" },
      }),
    ],
  },
  ApiErrorResponse: errorResponseSchema(ALL_ERROR_CODES),
  BadRequestErrorResponse: errorResponseSchema([
    "VALIDATION_ERROR",
    "IDEMPOTENCY_KEY_REQUIRED",
  ]),
  UnauthorizedErrorResponse: errorResponseSchema([
    "AUTH_INVALID_CREDENTIALS",
    "AUTH_SESSION_INVALID",
  ]),
  ForbiddenErrorResponse: errorResponseSchema(["FORBIDDEN"]),
  NotFoundErrorResponse: errorResponseSchema(["RESOURCE_NOT_FOUND"]),
  ConflictErrorResponse: errorResponseSchema([
    "VERSION_CONFLICT",
    "IDEMPOTENCY_CONFLICT",
  ]),
  UnprocessableEntityErrorResponse: errorResponseSchema([
    "INVALID_STATE",
    "SOURCE_NOT_CONFIGURED",
    "SOURCE_UNAVAILABLE",
    "QUANTITY_EXCEEDS_REMAINING",
    "INSUFFICIENT_STOCK",
    "DATA_INCOMPLETE",
    "POLICY_NOT_CONFIGURED",
  ]),
  TooManyRequestsErrorResponse: errorResponseSchema(["RATE_LIMITED"]),
  InternalServerErrorResponse: errorResponseSchema(["INTERNAL_ERROR"]),
  GenericObject: { type: "object", additionalProperties: true },
  AuthSession: entity(["access_token", "refresh_token", "expires_in"], {
    access_token: { type: "string" },
    refresh_token: { type: "string" },
    expires_in: { type: "string", example: "15m" },
    user: entity(["id", "username", "display_name", "kind"], {
      id: uuid,
      username: { type: "string" },
      display_name: { type: "string" },
      kind: { type: "string", enum: ["INTERNAL", "SUPPLIER"] },
    }),
  }),
  MeProfile: entity(
    ["id", "username", "display_name", "kind", "organization_id"],
    {
      id: uuid,
      username: { type: "string" },
      display_name: { type: "string" },
      kind: { type: "string", enum: ["INTERNAL", "SUPPLIER"] },
      organization_id: uuid,
      supplier_id: nullable(uuid),
      identity_number: nullable({ type: "string" }),
      date_of_birth: nullable(date),
      phone: nullable({ type: "string" }),
      email: nullable({ type: "string", format: "email" }),
      address: nullable({ type: "string" }),
    },
  ),
  PermissionGrant: entity(["id", "roleCode", "permissions", "scopeType"], {
    id: uuid,
    roleCode: { type: "string" },
    permissions: arrayOf({ type: "string" }),
    scopeType: {
      type: "string",
      enum: [
        "ORGANIZATION",
        "FACILITY",
        "STOCK_LOCATION",
        "DEPARTMENT",
        "OWN",
        "SUPPLIER",
      ],
    },
    facilityId: nullable(uuid),
    stockLocationId: nullable(uuid),
    departmentId: nullable(uuid),
  }),
  PermissionContext: entity(["permissions", "grants"], {
    permissions: arrayOf({ type: "string" }),
    grants: arrayOf(ref("PermissionGrant")),
  }),
  UserRef: entity(["id", "displayName"], {
    id: uuid,
    displayName: { type: "string" },
    username: { type: "string" },
  }),
  ApprovalEvent: entity(["id", "actorId", "decision", "policy", "createdAt"], {
    id: uuid,
    actorId: uuid,
    decision: {
      type: "string",
      enum: ["APPROVED", "REJECTED", "AUTO_APPROVED"],
    },
    policy: { type: "string" },
    note: nullable({ type: "string" }),
    createdAt: dateTime,
  }),
  Facility: entity(["id", "organizationId", "code", "name", "type", "active"], {
    id: uuid,
    organizationId: uuid,
    code: { type: "string" },
    name: { type: "string" },
    type: {
      type: "string",
      enum: ["CENTRAL_WAREHOUSE", "CENTRAL_KITCHEN", "BRANCH"],
    },
    active: { type: "boolean" },
    createdAt: dateTime,
    updatedAt: dateTime,
  }),
  StockLocation: entity(
    ["id", "facilityId", "code", "name", "type", "active"],
    {
      id: uuid,
      facilityId: uuid,
      code: { type: "string" },
      name: { type: "string" },
      type: { type: "string", enum: ["PHYSICAL", "IN_TRANSIT"] },
      active: { type: "boolean" },
      facility: ref("Facility"),
    },
  ),
  Department: entity(["id", "facilityId", "code", "name", "type", "active"], {
    id: uuid,
    facilityId: uuid,
    stockLocationId: nullable(uuid),
    code: { type: "string" },
    name: { type: "string" },
    type: {
      type: "string",
      enum: ["KITCHEN", "TABLE", "WAREHOUSE", "INVENTORY", "OTHER"],
    },
    active: { type: "boolean" },
    facility: ref("Facility"),
    stockLocation: nullable(ref("StockLocation")),
  }),
  Unit: entity(["id", "code", "name", "decimalScale", "active"], {
    id: uuid,
    code: { type: "string" },
    name: { type: "string" },
    decimalScale: { type: "integer", minimum: 0, maximum: 6 },
    active: { type: "boolean" },
  }),
  IngredientGroup: entity(["id", "code", "name", "active"], {
    id: uuid,
    code: { type: "string" },
    name: { type: "string" },
    active: { type: "boolean" },
  }),
  Ingredient: entity(["id", "baseUnitId", "code", "name", "active"], {
    id: uuid,
    groupId: nullable(uuid),
    baseUnitId: uuid,
    code: { type: "string" },
    name: { type: "string" },
    active: { type: "boolean" },
    group: nullable(ref("IngredientGroup")),
    baseUnit: ref("Unit"),
  }),
  UnitConversion: entity(
    [
      "id",
      "ingredientId",
      "unitId",
      "factorToBase",
      "version",
      "effectiveFrom",
    ],
    {
      id: uuid,
      ingredientId: uuid,
      unitId: uuid,
      factorToBase: decimal,
      version: { type: "integer", minimum: 1 },
      effectiveFrom: dateTime,
      effectiveTo: nullable(dateTime),
      ingredient: ref("Ingredient"),
      unit: ref("Unit"),
    },
  ),
  Supplier: entity(["id", "code", "name", "active"], {
    id: uuid,
    code: { type: "string" },
    name: { type: "string" },
    phone: nullable({ type: "string" }),
    email: nullable({ type: "string", format: "email" }),
    active: { type: "boolean" },
  }),
  SupplierIngredient: entity(["id", "supplierId", "ingredientId", "active"], {
    id: uuid,
    supplierId: uuid,
    ingredientId: uuid,
    supplierSku: nullable({ type: "string" }),
    referencePrice: nullable(decimal),
    active: { type: "boolean" },
    supplier: ref("Supplier"),
    ingredient: ref("Ingredient"),
  }),
  ItemEligibility: entity(
    [
      "id",
      "facilityId",
      "departmentId",
      "ingredientId",
      "maxQuantityPerRequest",
      "active",
    ],
    {
      id: uuid,
      facilityId: uuid,
      departmentId: uuid,
      ingredientId: uuid,
      maxQuantityPerRequest: nullable(decimal),
      active: { type: "boolean" },
      facility: ref("Facility"),
      department: ref("Department"),
      ingredient: ref("Ingredient"),
    },
  ),
  SourceRule: entity(
    [
      "id",
      "facilityId",
      "ingredientId",
      "sourceType",
      "revision",
      "active",
      "effectiveFrom",
    ],
    {
      id: uuid,
      facilityId: uuid,
      ingredientId: uuid,
      sourceType: { type: "string", enum: ["STOCK", "SUPPLIER"] },
      sourceStockLocationId: nullable(uuid),
      supplierId: nullable(uuid),
      revision: { type: "integer", minimum: 1 },
      active: { type: "boolean" },
      effectiveFrom: dateTime,
      facility: ref("Facility"),
      ingredient: ref("Ingredient"),
      sourceStockLocation: nullable(ref("StockLocation")),
      supplier: nullable(ref("Supplier")),
    },
  ),
  RequestLine: entity(
    [
      "id",
      "ingredientId",
      "requestedUnitId",
      "requestedQuantity",
      "baseQuantity",
      "ingredientNameSnapshot",
      "unitCodeSnapshot",
    ],
    {
      id: uuid,
      ingredientId: uuid,
      requestedUnitId: uuid,
      requestedQuantity: decimal,
      baseQuantity: decimal,
      ingredientNameSnapshot: { type: "string" },
      unitCodeSnapshot: { type: "string" },
      conversionFactorSnapshot: decimal,
      sourceTypeSnapshot: nullable({
        type: "string",
        enum: ["STOCK", "SUPPLIER"],
      }),
      sourceRuleRevision: nullable({ type: "integer" }),
      sourceStockLocationId: nullable(uuid),
      supplierId: nullable(uuid),
      ingredient: ref("Ingredient"),
    },
  ),
  SupplyRequest: entity(
    [
      "id",
      "facilityId",
      "departmentId",
      "createdById",
      "code",
      "status",
      "requiredDate",
      "version",
      "createdAt",
    ],
    {
      id: uuid,
      facilityId: uuid,
      departmentId: uuid,
      createdById: uuid,
      code: { type: "string" },
      status: documentStatus,
      requiredDate: dateTime,
      note: nullable({ type: "string" }),
      version: { type: "integer", minimum: 1 },
      submittedAt: nullable(dateTime),
      decidedAt: nullable(dateTime),
      createdAt: dateTime,
      updatedAt: dateTime,
      facility: ref("Facility"),
      department: ref("Department"),
      createdBy: ref("UserRef"),
      lines: arrayOf(ref("RequestLine")),
      approvals: arrayOf(ref("ApprovalEvent")),
      orders: arrayOf(ref("FulfillmentOrder")),
    },
  ),
  TransferLine: entity(
    [
      "id",
      "ingredientId",
      "quantity",
      "ingredientNameSnapshot",
      "unitCodeSnapshot",
    ],
    {
      id: uuid,
      ingredientId: uuid,
      quantity: decimal,
      ingredientNameSnapshot: { type: "string" },
      unitCodeSnapshot: { type: "string" },
      ingredient: ref("Ingredient"),
    },
  ),
  Transfer: entity(
    [
      "id",
      "organizationId",
      "code",
      "fromStockLocationId",
      "toStockLocationId",
      "createdById",
      "status",
      "version",
      "expectedArrivalAt",
      "createdAt",
      "updatedAt",
    ],
    {
      id: uuid,
      organizationId: uuid,
      code: { type: "string" },
      fromStockLocationId: uuid,
      toStockLocationId: uuid,
      createdById: uuid,
      status: documentStatus,
      version: { type: "integer", minimum: 1 },
      note: nullable({ type: "string" }),
      expectedArrivalAt: nullable(dateTime),
      submittedAt: nullable(dateTime),
      decidedAt: nullable(dateTime),
      createdAt: dateTime,
      updatedAt: dateTime,
      fromStockLocation: ref("StockLocation"),
      toStockLocation: ref("StockLocation"),
      createdBy: ref("UserRef"),
      lines: arrayOf(ref("TransferLine")),
      approvals: arrayOf(ref("ApprovalEvent")),
      orders: arrayOf(ref("FulfillmentOrder")),
    },
  ),
  FulfillmentLine: entity(
    [
      "id",
      "orderId",
      "ingredientId",
      "approvedQuantity",
      "dispatchedQuantity",
      "receivedQuantity",
      "acceptedExcessQuantity",
      "closedRemainingQuantity",
      "unitCodeSnapshot",
      "version",
    ],
    {
      id: uuid,
      orderId: uuid,
      requestLineId: nullable(uuid),
      transferLineId: nullable(uuid),
      ingredientId: uuid,
      approvedQuantity: decimal,
      dispatchedQuantity: decimal,
      receivedQuantity: decimal,
      acceptedExcessQuantity: decimal,
      closedRemainingQuantity: decimal,
      unitCodeSnapshot: { type: "string" },
      unitPriceSnapshot: nullable(decimal),
      version: { type: "integer", minimum: 1 },
      ingredient: ref("Ingredient"),
    },
  ),
  FulfillmentOrder: entity(
    [
      "id",
      "code",
      "sourceType",
      "destinationStockLocationId",
      "status",
      "version",
      "createdAt",
    ],
    {
      id: uuid,
      requestId: nullable(uuid),
      transferId: nullable(uuid),
      code: { type: "string" },
      sourceType: { type: "string", enum: ["STOCK", "SUPPLIER"] },
      sourceStockLocationId: nullable(uuid),
      supplierId: nullable(uuid),
      destinationStockLocationId: uuid,
      status: orderStatus,
      version: { type: "integer", minimum: 1 },
      releasedAt: nullable(dateTime),
      createdAt: dateTime,
      updatedAt: dateTime,
      supplier: nullable(ref("Supplier")),
      sourceStockLocation: nullable(ref("StockLocation")),
      destinationStockLocation: ref("StockLocation"),
      lines: arrayOf(ref("FulfillmentLine")),
      dispatches: arrayOf(ref("Dispatch")),
      receipts: arrayOf(ref("Receipt")),
    },
  ),
  SupplierOrderProjection: entity(
    ["id", "code", "status", "releasedAt", "destinationStockLocation", "lines"],
    {
      id: uuid,
      code: { type: "string" },
      status: orderStatus,
      releasedAt: nullable(dateTime),
      destinationStockLocation: entity(["name", "facility"], {
        name: { type: "string" },
        facility: entity(["name"], { name: { type: "string" } }),
      }),
      lines: arrayOf(
        entity(
          [
            "id",
            "approvedQuantity",
            "receivedQuantity",
            "unitCodeSnapshot",
            "ingredient",
          ],
          {
            id: uuid,
            approvedQuantity: decimal,
            receivedQuantity: decimal,
            unitCodeSnapshot: { type: "string" },
            unitPriceSnapshot: nullable(decimal),
            ingredient: entity(["code", "name"], {
              code: { type: "string" },
              name: { type: "string" },
            }),
          },
        ),
      ),
    },
  ),
  DispatchLine: entity(["id", "dispatchId", "orderLineId", "quantity"], {
    id: uuid,
    dispatchId: uuid,
    orderLineId: uuid,
    quantity: decimal,
  }),
  Dispatch: entity(
    ["id", "orderId", "code", "status", "version", "createdById", "createdAt"],
    {
      id: uuid,
      orderId: uuid,
      code: { type: "string" },
      status: { type: "string", enum: ["DRAFT", "POSTED", "CANCELLED"] },
      version: { type: "integer", minimum: 1 },
      createdById: uuid,
      postedById: nullable(uuid),
      postedAt: nullable(dateTime),
      note: nullable({ type: "string" }),
      createdAt: dateTime,
      order: ref("FulfillmentOrder"),
      lines: arrayOf(ref("DispatchLine")),
    },
  ),
  ReceiptLine: entity(
    [
      "id",
      "receiptId",
      "orderLineId",
      "reportedQuantity",
      "acceptedQuantity",
      "excessQuantity",
    ],
    {
      id: uuid,
      receiptId: uuid,
      orderLineId: uuid,
      reportedQuantity: decimal,
      acceptedQuantity: decimal,
      excessQuantity: decimal,
      note: nullable({ type: "string" }),
    },
  ),
  Receipt: entity(
    ["id", "orderId", "code", "status", "version", "createdById", "createdAt"],
    {
      id: uuid,
      orderId: uuid,
      dispatchId: nullable(uuid),
      code: { type: "string" },
      status: {
        type: "string",
        enum: ["DRAFT", "POSTED", "PENDING_EXCESS_REVIEW", "CANCELLED"],
      },
      version: { type: "integer", minimum: 1 },
      createdById: uuid,
      postedById: nullable(uuid),
      postedAt: nullable(dateTime),
      note: nullable({ type: "string" }),
      createdAt: dateTime,
      order: ref("FulfillmentOrder"),
      lines: arrayOf(ref("ReceiptLine")),
      discrepancies: arrayOf(ref("DiscrepancyCase")),
    },
  ),
  DiscrepancyCase: entity(
    [
      "id",
      "receiptId",
      "receiptLineId",
      "type",
      "status",
      "expectedQuantity",
      "actualQuantity",
      "createdAt",
    ],
    {
      id: uuid,
      receiptId: uuid,
      receiptLineId: uuid,
      type: { type: "string", enum: ["SHORTAGE", "EXCESS", "DAMAGED"] },
      status: { type: "string", enum: ["OPEN", "RESOLVED"] },
      expectedQuantity: decimal,
      actualQuantity: decimal,
      resolution: nullable({ type: "string" }),
      resolvedById: nullable(uuid),
      resolvedAt: nullable(dateTime),
      createdAt: dateTime,
    },
  ),
  StockBalance: entity(
    [
      "id",
      "stockLocationId",
      "ingredientId",
      "quantity",
      "version",
      "updatedAt",
    ],
    {
      id: uuid,
      stockLocationId: uuid,
      ingredientId: uuid,
      quantity: decimal,
      version: { type: "integer", minimum: 1 },
      updatedAt: dateTime,
      stockLocation: ref("StockLocation"),
      ingredient: ref("Ingredient"),
    },
  ),
  StockLedgerEntry: entity(
    [
      "id",
      "stockLocationId",
      "ingredientId",
      "entryType",
      "quantity",
      "postingKey",
      "postedAt",
    ],
    {
      id: uuid,
      stockLocationId: uuid,
      ingredientId: uuid,
      entryType: {
        type: "string",
        enum: [
          "DISPATCH_OUT",
          "TRANSIT_IN",
          "TRANSIT_OUT",
          "RECEIPT_IN",
          "SUPPLIER_RECEIPT_IN",
          "ADJUSTMENT",
          "DAMAGE",
          "REVERSAL",
        ],
      },
      quantity: decimal,
      sourceType: { type: "string" },
      sourceId: uuid,
      sourceLineId: uuid,
      postingKey: { type: "string" },
      postedById: uuid,
      postedAt: dateTime,
      stockLocation: ref("StockLocation"),
      ingredient: ref("Ingredient"),
    },
  ),
  Notification: entity(
    [
      "id",
      "title",
      "message",
      "resourceType",
      "resourceId",
      "status",
      "createdAt",
    ],
    {
      id: uuid,
      title: { type: "string" },
      message: { type: "string" },
      resourceType: { type: "string" },
      resourceId: uuid,
      status: { type: "string", enum: ["UNREAD", "READ"] },
      readAt: nullable(dateTime),
      createdAt: dateTime,
    },
  ),
  PushDevice: entity(["id", "platform", "lastSeenAt"], {
    id: uuid,
    platform: { type: "string", enum: ["ANDROID", "IOS"] },
    deviceId: nullable({ type: "string" }),
    appVersion: nullable({ type: "string" }),
    lastSeenAt: dateTime,
    createdAt: dateTime,
  }),
  UpdatedCount: entity(["updated"], {
    updated: { type: "integer", minimum: 0 },
  }),
  Attachment: entity(
    [
      "id",
      "resourceType",
      "resourceId",
      "fileName",
      "mimeType",
      "sizeBytes",
      "createdAt",
    ],
    {
      id: uuid,
      resourceType: { type: "string", enum: ["RECEIPT", "DAMAGE_REPORT"] },
      resourceId: uuid,
      fileName: { type: "string" },
      mimeType: { type: "string" },
      sizeBytes: { type: "integer", minimum: 1 },
      createdAt: dateTime,
    },
  ),
  AttachmentUploadInit: entity(
    ["attachment", "uploadUrl", "method", "headers", "expiresAt"],
    {
      attachment: ref("Attachment"),
      uploadUrl: { type: "string", format: "uri" },
      method: { type: "string", enum: ["PUT"] },
      headers: {
        type: "object",
        additionalProperties: { type: "string" },
      },
      expiresAt: dateTime,
    },
  ),
  StocktakeLine: entity(
    ["id", "ingredientId", "countedQuantity", "countedAt"],
    {
      id: uuid,
      ingredientId: uuid,
      countedQuantity: decimal,
      expectedQuantitySnapshot: nullable(decimal),
      varianceQuantity: nullable(decimal),
      countedAt: dateTime,
      ingredient: ref("Ingredient"),
    },
  ),
  Stocktake: entity(
    [
      "id",
      "stockLocationId",
      "businessDate",
      "cutoffAt",
      "status",
      "version",
      "createdById",
      "createdAt",
    ],
    {
      id: uuid,
      stockLocationId: uuid,
      businessDate: dateTime,
      cutoffAt: dateTime,
      status: { type: "string", enum: ["DRAFT", "SUBMITTED", "REOPENED"] },
      version: { type: "integer", minimum: 1 },
      createdById: uuid,
      createdAt: dateTime,
      submittedAt: nullable(dateTime),
      stockLocation: ref("StockLocation"),
      lines: arrayOf(ref("StocktakeLine")),
    },
  ),
  DamageLine: entity(["id", "ingredientId", "quantity", "unitCode"], {
    id: uuid,
    ingredientId: uuid,
    quantity: decimal,
    unitCode: { type: "string" },
    reason: nullable({ type: "string" }),
    ingredient: ref("Ingredient"),
  }),
  DamageReport: entity(
    [
      "id",
      "stockLocationId",
      "code",
      "status",
      "version",
      "reason",
      "createdById",
      "createdAt",
    ],
    {
      id: uuid,
      stockLocationId: uuid,
      code: { type: "string" },
      status: {
        type: "string",
        enum: ["DRAFT", "SUBMITTED", "CONFIRMED", "REJECTED"],
      },
      version: { type: "integer", minimum: 1 },
      reason: { type: "string" },
      createdById: uuid,
      createdAt: dateTime,
      submittedAt: nullable(dateTime),
      confirmedAt: nullable(dateTime),
      stockLocation: ref("StockLocation"),
      lines: arrayOf(ref("DamageLine")),
    },
  ),
  PaymentTracking: entity(
    [
      "orderId",
      "orderCode",
      "reconciledValue",
      "paidValue",
      "status",
      "version",
    ],
    {
      orderId: uuid,
      orderCode: { type: "string" },
      reconciledValue: decimal,
      paidValue: decimal,
      status: { type: "string", enum: ["UNPAID", "PARTIAL", "PAID"] },
      version: { type: "integer", minimum: 0 },
    },
  ),
  PaymentTrackingReport: entity(
    [
      "id",
      "orderId",
      "reconciledValue",
      "paidValue",
      "status",
      "version",
      "updatedAt",
    ],
    {
      id: uuid,
      orderId: uuid,
      reconciledValue: decimal,
      paidValue: decimal,
      status: { type: "string", enum: ["UNPAID", "PARTIAL", "PAID"] },
      version: { type: "integer", minimum: 1 },
      updatedAt: dateTime,
      order: ref("FulfillmentOrder"),
    },
  ),
  InventoryAdjustment: entity(
    [
      "id",
      "stockLocationId",
      "ingredientId",
      "quantity",
      "reason",
      "status",
      "version",
      "createdAt",
    ],
    {
      id: uuid,
      stockLocationId: uuid,
      ingredientId: uuid,
      quantity: decimal,
      reason: { type: "string" },
      sourceType: nullable({ type: "string" }),
      sourceId: nullable(uuid),
      status: {
        type: "string",
        enum: ["DRAFT", "APPROVED", "POSTED", "REJECTED", "CANCELLED"],
      },
      version: { type: "integer", minimum: 1 },
      createdById: uuid,
      approvedAt: nullable(dateTime),
      postedAt: nullable(dateTime),
      createdAt: dateTime,
      stockLocation: ref("StockLocation"),
      ingredient: ref("Ingredient"),
    },
  ),
  MenuItemMapping: entity(
    ["id", "facilityId", "source", "externalItemKey", "menuItemName", "active"],
    {
      id: uuid,
      facilityId: uuid,
      source: { type: "string" },
      externalItemKey: { type: "string" },
      menuItemName: { type: "string" },
      active: { type: "boolean" },
      facility: ref("Facility"),
    },
  ),
  RecipeIngredient: entity(["id", "ingredientId", "baseQuantity"], {
    id: uuid,
    ingredientId: uuid,
    baseQuantity: decimal,
    ingredient: ref("Ingredient"),
  }),
  RecipeVersion: entity(
    [
      "id",
      "mappingId",
      "stockLocationId",
      "version",
      "effectiveFrom",
      "createdAt",
    ],
    {
      id: uuid,
      mappingId: uuid,
      stockLocationId: uuid,
      version: { type: "integer", minimum: 1 },
      effectiveFrom: dateTime,
      effectiveTo: nullable(dateTime),
      createdAt: dateTime,
      mapping: ref("MenuItemMapping"),
      stockLocation: ref("StockLocation"),
      ingredients: arrayOf(ref("RecipeIngredient")),
    },
  ),
  SalesRecord: entity(
    ["id", "externalKey", "externalItemKey", "soldAt", "quantity"],
    {
      id: uuid,
      externalKey: { type: "string" },
      externalItemKey: { type: "string" },
      soldAt: dateTime,
      quantity: decimal,
      validationError: nullable({ type: "string" }),
      mappingId: nullable(uuid),
    },
  ),
  SalesImportBatch: entity(
    ["id", "facilityId", "source", "externalKey", "status", "createdAt"],
    {
      id: uuid,
      facilityId: uuid,
      source: { type: "string" },
      externalKey: { type: "string" },
      status: {
        type: "string",
        enum: ["DRAFT", "VALIDATED", "DATA_INCOMPLETE", "COMMITTED", "FAILED"],
      },
      errorSummary: nullable({ type: "object", additionalProperties: true }),
      createdAt: dateTime,
      committedAt: nullable(dateTime),
      facility: ref("Facility"),
      records: arrayOf(ref("SalesRecord")),
    },
  ),
  SalesImportValidation: entity(["batch_id", "valid", "errors"], {
    batch_id: uuid,
    valid: { type: "boolean" },
    errors: arrayOf(
      entity(["record_id", "code"], {
        record_id: uuid,
        code: { type: "string" },
      }),
    ),
  }),
  SalesImportCommit: entity(["batch_id", "status"], {
    batch_id: uuid,
    status: { type: "string", enum: ["COMMITTED"] },
  }),
  IposAdapterStatus: entity(["adapter", "real_ipos_api_connected", "status"], {
    adapter: { type: "string" },
    real_ipos_api_connected: { type: "boolean" },
    status: { type: "string" },
  }),
  VarianceResult: entity(
    [
      "id",
      "stocktakeId",
      "stockLocationId",
      "ingredientId",
      "version",
      "dataStatus",
      "actualClosingSnapshot",
      "calculatedAt",
    ],
    {
      id: uuid,
      stocktakeId: uuid,
      stockLocationId: uuid,
      ingredientId: uuid,
      version: { type: "integer", minimum: 1 },
      dataStatus: { type: "string", enum: ["COMPLETE", "DATA_INCOMPLETE"] },
      openingStockSnapshot: nullable(decimal),
      postedMovementSnapshot: nullable(decimal),
      expectedUsageSnapshot: nullable(decimal),
      expectedClosingSnapshot: nullable(decimal),
      actualClosingSnapshot: decimal,
      varianceQuantity: nullable(decimal),
      varianceRate: nullable(decimal),
      missingData: nullable({ type: "object", additionalProperties: true }),
      calculatedAt: dateTime,
      stockLocation: ref("StockLocation"),
      ingredient: ref("Ingredient"),
      stocktake: ref("Stocktake"),
    },
  ),
  AlertRule: entity(
    ["id", "thresholdType", "thresholdValue", "testOnly", "active"],
    {
      id: uuid,
      facilityId: nullable(uuid),
      ingredientId: nullable(uuid),
      thresholdType: { type: "string", enum: ["QUANTITY", "PERCENT"] },
      thresholdValue: decimal,
      testOnly: { type: "boolean" },
      active: { type: "boolean" },
      facility: nullable(ref("Facility")),
      ingredient: nullable(ref("Ingredient")),
    },
  ),
  User: entity(
    ["id", "kind", "username", "displayName", "active", "createdAt"],
    {
      id: uuid,
      supplierId: nullable(uuid),
      kind: { type: "string", enum: ["INTERNAL", "SUPPLIER"] },
      username: { type: "string" },
      displayName: { type: "string" },
      active: { type: "boolean" },
      lastLoginAt: nullable(dateTime),
      createdAt: dateTime,
    },
  ),
  Permission: entity(["code", "description"], {
    code: { type: "string" },
    description: { type: "string" },
  }),
  Role: entity(["id", "code", "name", "system", "active"], {
    id: uuid,
    code: { type: "string" },
    name: { type: "string" },
    system: { type: "boolean" },
    active: { type: "boolean" },
    permissions: arrayOf(
      entity(["permissionCode"], {
        permissionCode: { type: "string" },
        permission: ref("Permission"),
      }),
    ),
  }),
  RoleGrant: entity(["id", "userId", "roleId", "scopeType", "createdAt"], {
    id: uuid,
    userId: uuid,
    roleId: uuid,
    scopeType: {
      type: "string",
      enum: [
        "ORGANIZATION",
        "FACILITY",
        "STOCK_LOCATION",
        "DEPARTMENT",
        "OWN",
        "SUPPLIER",
      ],
    },
    facilityId: nullable(uuid),
    stockLocationId: nullable(uuid),
    departmentId: nullable(uuid),
    revokedAt: nullable(dateTime),
    createdAt: dateTime,
    user: ref("User"),
    role: ref("Role"),
    facility: nullable(ref("Facility")),
    stockLocation: nullable(ref("StockLocation")),
    department: nullable(ref("Department")),
  }),
  AuditEvent: entity(
    ["id", "action", "resourceType", "resourceId", "createdAt"],
    {
      id: uuid,
      actorId: nullable(uuid),
      action: { type: "string" },
      resourceType: { type: "string" },
      resourceId: { type: "string" },
      requestId: nullable(uuid),
      beforeData: nullable({ type: "object", additionalProperties: true }),
      afterData: nullable({ type: "object", additionalProperties: true }),
      createdAt: dateTime,
    },
  ),
  ConfigurationObject: { type: "object", additionalProperties: true },
  DashboardSummary: { type: "object", additionalProperties: true },
  ReportRow: { type: "object", additionalProperties: true },
  HealthStatus: entity(["status"], {
    status: { type: "string", enum: ["ok", "error"] },
  }),
};

const LIST_ROUTES = new Set([
  "/facilities",
  "/stock-locations",
  "/departments",
  "/units",
  "/ingredient-groups",
  "/ingredients",
  "/suppliers",
  "/supplier-ingredients",
  "/conversions",
  "/item-eligibility",
  "/source-rules",
  "/requests",
  "/transfers",
  "/orders",
  "/supplier/orders",
  "/dispatches",
  "/receipts",
  "/discrepancies",
  "/stock-balances",
  "/stock-ledger",
  "/notifications",
  "/stocktakes",
  "/damage-reports",
  "/users",
  "/roles",
  "/permissions",
  "/grants",
  "/audit-events",
  "/inventory-adjustments",
  "/menu-item-mappings",
  "/recipes",
  "/sales-imports",
  "/variances",
  "/alert-rules",
  "/reports/stock",
  "/reports/fulfillment",
  "/reports/damage",
  "/reports/variance",
  "/reports/payment",
]);

function normalizedPath(path: string): string {
  return path.replace(/^\/api\/v1(?=\/)/, "");
}

function responseSchemaName(path: string): string {
  if (/^\/auth\/(login|refresh)$/.test(path)) return "AuthSession";
  if (path === "/me" || path === "/me/profile") return "MeProfile";
  if (path === "/me/permissions") return "PermissionContext";
  if (path.startsWith("/facilities")) return "Facility";
  if (path.startsWith("/stock-locations")) return "StockLocation";
  if (path.startsWith("/departments")) return "Department";
  if (path.startsWith("/ingredient-groups")) return "IngredientGroup";
  if (path.startsWith("/ingredients")) return "Ingredient";
  if (path.startsWith("/supplier-ingredients")) return "SupplierIngredient";
  if (path.startsWith("/suppliers")) return "Supplier";
  if (path.startsWith("/conversions")) return "UnitConversion";
  if (path.startsWith("/units")) return "Unit";
  if (path.startsWith("/item-eligibility")) return "ItemEligibility";
  if (path.startsWith("/source-rules")) return "SourceRule";
  if (path.startsWith("/requests")) return "SupplyRequest";
  if (path.startsWith("/transfers")) return "Transfer";
  if (/^\/orders\/\{[^}]+\}\/payment-tracking$/.test(path))
    return "PaymentTracking";
  if (path.startsWith("/supplier/orders")) return "SupplierOrderProjection";
  if (path.startsWith("/orders")) return "FulfillmentOrder";
  if (path.startsWith("/dispatches")) return "Dispatch";
  if (path.startsWith("/receipts")) return "Receipt";
  if (path.startsWith("/discrepancies")) return "DiscrepancyCase";
  if (path.startsWith("/stock-balances")) return "StockBalance";
  if (path.startsWith("/stock-ledger")) return "StockLedgerEntry";
  if (path === "/notifications/read-all") return "UpdatedCount";
  if (path.startsWith("/notifications")) return "Notification";
  if (path === "/push-devices/unregister") return "UpdatedCount";
  if (path.startsWith("/push-devices")) return "PushDevice";
  if (path === "/attachments/upload-init") return "AttachmentUploadInit";
  if (path.startsWith("/attachments")) return "Attachment";
  if (path.startsWith("/stocktakes")) return "Stocktake";
  if (path.startsWith("/damage-reports")) return "DamageReport";
  if (path.startsWith("/users")) return "User";
  if (path.startsWith("/roles")) return "Role";
  if (path.startsWith("/permissions")) return "Permission";
  if (path.startsWith("/grants")) return "RoleGrant";
  if (path.startsWith("/audit-events")) return "AuditEvent";
  if (path.startsWith("/inventory-adjustments")) return "InventoryAdjustment";
  if (path.startsWith("/menu-item-mappings")) return "MenuItemMapping";
  if (path.startsWith("/recipes")) return "RecipeVersion";
  if (path === "/sales-imports/adapter-status") return "IposAdapterStatus";
  if (/^\/sales-imports\/\{[^}]+\}\/validate$/.test(path))
    return "SalesImportValidation";
  if (/^\/sales-imports\/\{[^}]+\}\/commit$/.test(path))
    return "SalesImportCommit";
  if (path.startsWith("/sales-imports")) return "SalesImportBatch";
  if (path.startsWith("/variances")) return "VarianceResult";
  if (path.startsWith("/alert-rules")) return "AlertRule";
  if (path === "/dashboard/summary") return "DashboardSummary";
  if (path === "/reports/stock") return "StockBalance";
  if (path === "/reports/fulfillment") return "FulfillmentOrder";
  if (path === "/reports/damage") return "DamageReport";
  if (path === "/reports/variance") return "VarianceResult";
  if (path === "/reports/payment") return "PaymentTrackingReport";
  if (path.startsWith("/health/")) return "HealthStatus";
  return "ConfigurationObject";
}

function successEnvelope(data: Schema, paginated: boolean): Schema {
  return entity(["success", "message", "data", "request_id", "timestamp"], {
    success: { type: "boolean", enum: [true] },
    message: { type: "string" },
    data,
    ...(paginated ? { meta: ref("PaginationMeta") } : {}),
    request_id: uuid,
    timestamp: dateTime,
  });
}

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;
const ERROR_RESPONSES = [
  ["400", "Dữ liệu đầu vào không hợp lệ", "BadRequestErrorResponse"],
  [
    "401",
    "Thiếu token hoặc phiên đăng nhập không hợp lệ",
    "UnauthorizedErrorResponse",
  ],
  ["403", "Không có permission/scope phù hợp", "ForbiddenErrorResponse"],
  [
    "404",
    "Không tìm thấy tài nguyên trong phạm vi được phép",
    "NotFoundErrorResponse",
  ],
  ["409", "Xung đột version hoặc idempotency", "ConflictErrorResponse"],
  [
    "422",
    "Trạng thái/policy nghiệp vụ không cho phép",
    "UnprocessableEntityErrorResponse",
  ],
  ["429", "Vượt giới hạn tần suất", "TooManyRequestsErrorResponse"],
  ["500", "Lỗi hệ thống", "InternalServerErrorResponse"],
] as const;

/**
 * Bổ sung envelope, data schema và error schema cho toàn bộ operation sau khi
 * Nest Swagger đã xác định đúng HTTP status (200/201) và request DTO.
 */
export function enhanceOpenApiDocument(document: OpenAPIObject): OpenAPIObject {
  document.components ??= {};
  document.components.schemas = {
    ...(document.components.schemas ?? {}),
    ...DICA_RESPONSE_SCHEMAS,
  } as NonNullable<NonNullable<OpenAPIObject["components"]>["schemas"]>;

  for (const [rawPath, pathItem] of Object.entries(document.paths)) {
    const path = normalizedPath(rawPath);
    for (const method of HTTP_METHODS) {
      const operation = pathItem?.[method];
      if (!operation) continue;
      const schemaName = responseSchemaName(path);
      const paginated = method === "get" && LIST_ROUTES.has(path);
      const plainList =
        method === "get" &&
        (path === "/push-devices" || path === "/attachments");
      const binary =
        method === "get" && /^\/attachments\/\{[^}]+\}\/content$/.test(path);
      const arrayResult =
        method === "post" &&
        (path === "/variances/recalculate" ||
          path === "/source-rules/bulk-update");
      const dataSchema =
        path === "/auth/logout"
          ? ({ nullable: true } as Schema)
          : paginated || plainList || arrayResult
            ? arrayOf(ref(schemaName))
            : ref(schemaName);
      const responseSchema = binary
        ? ({ type: "string", format: "binary" } as Schema)
        : successEnvelope(dataSchema, paginated);
      const mediaType = binary
        ? "application/octet-stream"
        : "application/json";

      let hasSuccess = false;
      for (const [status, response] of Object.entries(operation.responses)) {
        if (!/^2\d\d$/.test(status) || !response || "$ref" in response)
          continue;
        hasSuccess = true;
        response.description ||= "Thao tác thành công.";
        response.content = {
          ...(response.content ?? {}),
          [mediaType]: { schema: responseSchema },
        };
      }
      if (!hasSuccess) {
        operation.responses["200"] = {
          description: "Thao tác thành công.",
          content: { [mediaType]: { schema: responseSchema } },
        };
      }
      for (const [status, description, errorSchemaName] of ERROR_RESPONSES) {
        const current = operation.responses[status];
        if (!current || "$ref" in current) {
          operation.responses[status] = {
            description,
            content: {
              "application/json": { schema: ref(errorSchemaName) },
            },
          };
          continue;
        }
        current.description ||= description;
        current.content = {
          ...(current.content ?? {}),
          "application/json": { schema: ref(errorSchemaName) },
        };
      }
      (operation as unknown as Record<string, unknown>)[
        "x-dica-response-schema"
      ] = schemaName;
    }
  }
  return document;
}
