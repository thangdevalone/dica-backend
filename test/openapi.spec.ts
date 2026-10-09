import assert from "node:assert/strict";
import test from "node:test";
import type { OpenAPIObject } from "@nestjs/swagger";
import {
  DICA_RESPONSE_SCHEMAS,
  enhanceOpenApiDocument,
} from "../src/common/swagger/openapi-response.js";

function document(): OpenAPIObject {
  return {
    openapi: "3.0.0",
    info: { title: "test", version: "1" },
    paths: {
      "/requests": {
        get: {
          responses: {
            "200": { description: "" },
            "404": { description: "Không tìm thấy yêu cầu" },
          },
        },
        post: { responses: { "201": { description: "" } } },
      },
      "/auth/logout": {
        post: { responses: { "201": { description: "" } } },
      },
    },
  };
}

test("OpenAPI response có envelope, data type, pagination và lỗi chuẩn", () => {
  const result = enhanceOpenApiDocument(document());
  const list = result.paths["/requests"]?.get;
  const create = result.paths["/requests"]?.post;
  const logout = result.paths["/auth/logout"]?.post;

  assert.equal(list?.["x-dica-response-schema"], "SupplyRequest");
  assert.deepEqual(
    list?.responses["200"] &&
      "$ref" in list.responses["200"] === false &&
      list.responses["200"].content?.["application/json"]?.schema,
    {
      type: "object",
      required: ["success", "message", "data", "request_id", "timestamp"],
      properties: {
        success: { type: "boolean", enum: [true] },
        message: { type: "string" },
        data: {
          type: "array",
          items: { $ref: "#/components/schemas/SupplyRequest" },
        },
        meta: { $ref: "#/components/schemas/PaginationMeta" },
        request_id: { type: "string", format: "uuid" },
        timestamp: { type: "string", format: "date-time" },
      },
      additionalProperties: true,
    },
  );
  assert.ok(create?.responses["201"]);
  assert.ok(create?.responses["409"]);
  assert.equal(logout?.["x-dica-response-schema"], "ConfigurationObject");
});

test("mọi HTTP status đều có response type cụ thể", () => {
  const result = enhanceOpenApiDocument(document());
  const expectedErrorTypes: Record<string, string> = {
    "400": "BadRequestErrorResponse",
    "401": "UnauthorizedErrorResponse",
    "403": "ForbiddenErrorResponse",
    "404": "NotFoundErrorResponse",
    "409": "ConflictErrorResponse",
    "422": "UnprocessableEntityErrorResponse",
    "429": "TooManyRequestsErrorResponse",
    "500": "InternalServerErrorResponse",
  };

  for (const pathItem of Object.values(result.paths)) {
    for (const operation of [pathItem?.get, pathItem?.post]) {
      if (!operation) continue;
      for (const [status, response] of Object.entries(operation.responses)) {
        assert.ok(
          response && !("$ref" in response),
          `${status} dùng $ref ngoài`,
        );
        if (!response || "$ref" in response) continue;
        const schema = response.content?.["application/json"]?.schema;
        assert.ok(schema, `status ${status} thiếu application/json schema`);
        if (expectedErrorTypes[status])
          assert.deepEqual(schema, {
            $ref: `#/components/schemas/${expectedErrorTypes[status]}`,
          });
      }
    }
  }
});

test("mọi $ref trong response schema đều trỏ tới component tồn tại", () => {
  const names = new Set(Object.keys(DICA_RESPONSE_SCHEMAS));
  const refs = JSON.stringify(DICA_RESPONSE_SCHEMAS).matchAll(
    /#\/components\/schemas\/([^"}]+)/g,
  );
  for (const match of refs) assert.ok(names.has(match[1]!), match[1]);
});

test("response schema có hạn mức gọi hàng và ETA điều chuyển đúng type", () => {
  const eligibility = DICA_RESPONSE_SCHEMAS.ItemEligibility as {
    properties: Record<string, unknown>;
  };
  const transfer = DICA_RESPONSE_SCHEMAS.Transfer as {
    properties: Record<string, unknown>;
  };

  assert.deepEqual(eligibility.properties.maxQuantityPerRequest, {
    type: "string",
    pattern: "^-?(?:0|[1-9]\\d*)(?:\\.\\d+)?$",
    example: "5.5",
    description: "Số thập phân được serialize dưới dạng chuỗi.",
    nullable: true,
  });
  assert.deepEqual(transfer.properties.expectedArrivalAt, {
    type: "string",
    format: "date-time",
    nullable: true,
  });
});

test("supplier preference and group eligibility expose concrete schemas", () => {
  const supplierIngredient = DICA_RESPONSE_SCHEMAS.SupplierIngredient as {
    properties: Record<string, unknown>;
  };
  const groupEligibility = DICA_RESPONSE_SCHEMAS.GroupEligibility as {
    properties: Record<string, unknown>;
  };

  assert.deepEqual(supplierIngredient.properties.isPreferred, {
    type: "boolean",
  });
  assert.deepEqual(groupEligibility.properties.ingredientGroupId, {
    type: "string",
    format: "uuid",
  });
});

test("supplier order projection exposes its own price after customer confirmation", () => {
  const supplierOrder = DICA_RESPONSE_SCHEMAS.SupplierOrderProjection as {
    properties: {
      lines: { items: { properties: Record<string, unknown> } };
    };
  };

  assert.equal(
    "unitPriceSnapshot" in supplierOrder.properties.lines.items.properties,
    true,
  );
});

test("FCM, attachment and iPOS operations expose concrete response models", () => {
  const input = document();
  input.paths["/push-devices"] = {
    get: { responses: { "200": { description: "" } } },
    post: { responses: { "201": { description: "" } } },
  };
  input.paths["/attachments"] = {
    get: { responses: { "200": { description: "" } } },
  };
  input.paths["/attachments/upload-init"] = {
    post: { responses: { "201": { description: "" } } },
  };
  input.paths["/variances/recalculate"] = {
    post: { responses: { "201": { description: "" } } },
  };
  input.paths["/reports/payment"] = {
    get: { responses: { "200": { description: "" } } },
  };
  const result = enhanceOpenApiDocument(input);
  assert.equal(
    result.paths["/push-devices"]?.get?.["x-dica-response-schema"],
    "PushDevice",
  );
  assert.equal(
    result.paths["/attachments"]?.get?.["x-dica-response-schema"],
    "AttachmentListItem",
  );
  assert.equal(
    result.paths["/attachments/upload-init"]?.post?.["x-dica-response-schema"],
    "AttachmentUploadInit",
  );
  assert.equal(
    result.paths["/variances/recalculate"]?.post?.["x-dica-response-schema"],
    "VarianceResult",
  );
  assert.equal(
    result.paths["/reports/payment"]?.get?.["x-dica-response-schema"],
    "PaymentTrackingReport",
  );
  const response =
    result.paths["/variances/recalculate"]?.post?.responses["201"];
  assert.ok(response && !("$ref" in response));
  const schema = response.content?.["application/json"]?.schema as {
    properties?: { data?: { type?: string } };
  };
  assert.equal(schema.properties?.data?.type, "array");
  const pushDevice = DICA_RESPONSE_SCHEMAS.PushDevice as {
    properties: { platform: { enum: string[] } };
  };
  assert.deepEqual(pushDevice.properties.platform.enum, ["ANDROID", "IOS"]);
});
