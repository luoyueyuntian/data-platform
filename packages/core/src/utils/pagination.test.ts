import { describe, it, expect } from 'vitest';
import { buildPaginationParams, paginateResult } from './pagination';

describe('buildPaginationParams', () => {
  it('should use defaults when no params provided', () => {
    const result = buildPaginationParams();
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('should clamp page to minimum 1', () => {
    expect(buildPaginationParams(0).page).toBe(1);
    expect(buildPaginationParams(-5).page).toBe(1);
  });

  it('should clamp pageSize between 1 and 100', () => {
    expect(buildPaginationParams(1, 0).pageSize).toBe(1);
    expect(buildPaginationParams(1, 200).pageSize).toBe(100);
    expect(buildPaginationParams(1, 50).pageSize).toBe(50);
  });

  it('should accept valid params', () => {
    const result = buildPaginationParams(3, 25);
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(25);
  });
});

describe('paginateResult', () => {
  it('should create paginated result', () => {
    const data = [1, 2, 3];
    const total = 100;
    const params = { page: 1, pageSize: 3 };

    const result = paginateResult(data, total, params);

    expect(result.data).toEqual(data);
    expect(result.total).toBe(100);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(3);
    expect(result.totalPages).toBe(34); // Math.ceil(100/3)
  });

  it('should handle empty data', () => {
    const result = paginateResult([], 0, { page: 1, pageSize: 20 });
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('should calculate total pages correctly', () => {
    expect(paginateResult([], 100, { page: 1, pageSize: 10 }).totalPages).toBe(10);
    expect(paginateResult([], 101, { page: 1, pageSize: 10 }).totalPages).toBe(11);
    expect(paginateResult([], 1, { page: 1, pageSize: 10 }).totalPages).toBe(1);
  });
});
