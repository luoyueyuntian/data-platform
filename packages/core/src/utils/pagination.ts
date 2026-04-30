import type { PaginatedResult, PaginationParams } from '../types/common';

export function buildPaginationParams(page?: number, pageSize?: number): PaginationParams {
  return {
    page: Math.max(1, page ?? 1),
    pageSize: Math.min(100, Math.max(1, pageSize ?? 20)),
  };
}

export function paginateResult<T>(data: T[], total: number, params: PaginationParams): PaginatedResult<T> {
  return {
    data,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.ceil(total / params.pageSize),
  };
}
