import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PaginationDto } from "../src/common/dto/pagination.dto.js";
import {
  offsetMeta,
  paginateById,
} from "../src/common/pagination/pagination.js";

const rows = [
  { id: "00000000-0000-4000-8000-000000000001" },
  { id: "00000000-0000-4000-8000-000000000002" },
  { id: "00000000-0000-4000-8000-000000000003" },
  { id: "00000000-0000-4000-8000-000000000004" },
];

test("offset pagination trả metadata đầy đủ", async () => {
  const query = Object.assign(new PaginationDto(), {
    page: 2,
    page_size: 2,
  });
  const result = await paginateById(
    query,
    ({ skip = 0, take }) => Promise.resolve(rows.slice(skip, skip + take)),
    () => Promise.resolve(rows.length),
  );

  assert.deepEqual(result.data, rows.slice(2));
  assert.deepEqual(result.meta, {
    mode: "offset",
    page: 2,
    page_size: 2,
    total: 4,
    total_pages: 2,
    has_next: false,
    has_previous: true,
  });
});

test("cursor pagination lấy dư một bản ghi và không count", async () => {
  const query = Object.assign(new PaginationDto(), {
    pagination_mode: "cursor" as const,
    page_size: 2,
  });
  let counted = false;
  const result = await paginateById(
    query,
    ({ take, cursorId }) => {
      const start = cursorId
        ? rows.findIndex((row) => row.id === cursorId) + 1
        : 0;
      return Promise.resolve(rows.slice(start, start + take));
    },
    () => {
      counted = true;
      return Promise.resolve(rows.length);
    },
  );

  assert.equal(counted, false);
  assert.deepEqual(result.data, rows.slice(0, 2));
  assert.deepEqual(result.meta, {
    mode: "cursor",
    page_size: 2,
    next_cursor: rows[1]!.id,
    has_next: true,
  });
});

test("page_size được giới hạn và cursor phải là UUID v4", async () => {
  const invalid = plainToInstance(PaginationDto, {
    page_size: 101,
    cursor: "khong-hop-le",
  });
  const errors = await validate(invalid);
  assert.equal(errors.length, 2);
});

test("chặn offset quá sâu để tránh query quét dữ liệu lớn", async () => {
  const invalid = plainToInstance(PaginationDto, { page: 10_001 });
  const errors = await validate(invalid);
  assert.equal(errors.length, 1);
  assert.ok(errors[0]?.constraints?.["max"]);
});

test("metadata rỗng không tạo trang ảo", () => {
  const query = new PaginationDto();
  assert.deepEqual(offsetMeta(query, 0), {
    mode: "offset",
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
    has_next: false,
    has_previous: false,
  });
});

test("không âm thầm nhận search hoặc sort ngoài allowlist", async () => {
  const query = Object.assign(new PaginationDto(), { sort_by: "unknown" });
  await assert.rejects(
    paginateById(
      query,
      () => Promise.resolve(rows),
      () => Promise.resolve(rows.length),
    ),
    /Endpoint này không hỗ trợ trường sắp xếp/,
  );
});

test("không trộn page với cursor mode", async () => {
  const query = Object.assign(new PaginationDto(), {
    page: 2,
    pagination_mode: "cursor" as const,
  });
  await assert.rejects(
    paginateById(
      query,
      () => Promise.resolve(rows),
      () => Promise.resolve(rows.length),
    ),
    /Không dùng page cùng cursor pagination/,
  );
});
