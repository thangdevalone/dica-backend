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
        get: { responses: { "200": { description: "" } } },
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

test("mọi $ref trong response schema đều trỏ tới component tồn tại", () => {
  const names = new Set(Object.keys(DICA_RESPONSE_SCHEMAS));
  const refs = JSON.stringify(DICA_RESPONSE_SCHEMAS).matchAll(
    /#\/components\/schemas\/([^"}]+)/g,
  );
  for (const match of refs) assert.ok(names.has(match[1]!), match[1]);
});
