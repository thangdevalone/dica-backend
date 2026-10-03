import { BadRequestException } from "@nestjs/common";
import type { PaginationDto } from "../dto/pagination.dto.js";

export interface PaginationWindow {
  take: number;
  skip?: number;
  cursorId?: string;
}

export interface OffsetPaginationMeta {
  mode: "offset";
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface CursorPaginationMeta {
  mode: "cursor";
  page_size: number;
  next_cursor: string | null;
  has_next: boolean;
}

export type PaginationMeta = OffsetPaginationMeta | CursorPaginationMeta;

export function pageSize(query: PaginationDto): number {
  return query.page_size ?? query.pageSize ?? 20;
}

export function isCursorPagination(query: PaginationDto): boolean {
  return query.pagination_mode === "cursor" || Boolean(query.cursor);
}

export async function paginateById<T extends { id: string }>(
  query: PaginationDto,
  load: (window: PaginationWindow) => Promise<T[]>,
  count: () => Promise<number>,
  options: { searchHandled?: boolean; sortHandled?: boolean } = {},
): Promise<{ data: T[]; meta: PaginationMeta }> {
  if (query.sort_by && !options.sortHandled)
    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      message: "Endpoint này không hỗ trợ trường sắp xếp đã gửi.",
      details: { sort_by: query.sort_by },
    });
  if (query.search && !options.searchHandled)
    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      message: "Endpoint này không hỗ trợ tìm kiếm.",
      details: { search: query.search },
    });
  const size = pageSize(query);
  if (isCursorPagination(query)) {
    if (query.page !== 1)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Không dùng page cùng cursor pagination.",
      });
    const rows = await load({
      take: size + 1,
      ...(query.cursor ? { skip: 1, cursorId: query.cursor } : {}),
    });
    const hasNext = rows.length > size;
    const data = hasNext ? rows.slice(0, size) : rows;
    return {
      data,
      meta: {
        mode: "cursor",
        page_size: size,
        next_cursor: hasNext ? (data.at(-1)?.id ?? null) : null,
        has_next: hasNext,
      },
    };
  }

  const page = query.page;
  const [data, total] = await Promise.all([
    load({ skip: (page - 1) * size, take: size }),
    count(),
  ]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / size);
  return {
    data,
    meta: {
      mode: "offset",
      page,
      page_size: size,
      total,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_previous: page > 1 && total > 0,
    },
  };
}

export function offsetWindow(
  query: PaginationDto,
  options: { searchHandled?: boolean; sortHandled?: boolean } = {},
): {
  skip: number;
  take: number;
} {
  if (isCursorPagination(query))
    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      message: "Endpoint này chỉ hỗ trợ offset pagination.",
    });
  if (query.sort_by && !options.sortHandled)
    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      message: "Endpoint này không hỗ trợ trường sắp xếp đã gửi.",
      details: { sort_by: query.sort_by },
    });
  if (query.search && !options.searchHandled)
    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      message: "Endpoint này không hỗ trợ tìm kiếm.",
      details: { search: query.search },
    });
  const size = pageSize(query);
  return { skip: (query.page - 1) * size, take: size };
}

export function offsetMeta(
  query: PaginationDto,
  total: number,
): OffsetPaginationMeta {
  const size = pageSize(query);
  const totalPages = total === 0 ? 0 : Math.ceil(total / size);
  return {
    mode: "offset",
    page: query.page,
    page_size: size,
    total,
    total_pages: totalPages,
    has_next: query.page < totalPages,
    has_previous: query.page > 1 && total > 0,
  };
}

export function resolveSort<T extends string>(
  query: PaginationDto,
  allowed: Readonly<Record<string, T>>,
  fallback: T,
): { field: T; direction: "asc" | "desc" } {
  if (query.sort_by && !allowed[query.sort_by])
    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      message: "Trường sắp xếp không được hỗ trợ.",
      details: { sort_by: query.sort_by, allowed: Object.keys(allowed) },
    });
  return {
    field: query.sort_by ? allowed[query.sort_by]! : fallback,
    direction: query.sort_order,
  };
}

export function normalizedSearch(query: PaginationDto): string | undefined {
  const value = query.search?.trim();
  return value || undefined;
}
