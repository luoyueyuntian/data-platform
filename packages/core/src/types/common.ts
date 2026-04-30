/**
 * Common — 通用类型
 */

/** 分页参数 */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/** 分页结果 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** API 响应格式 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
  error?: string;
}

export type SortOrder = 'asc' | 'desc';
