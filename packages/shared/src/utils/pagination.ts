import type { PaginatedResponse } from '../types/index.js';

export type NormalizedPagination = {
  page: number;
  limit: number;
  skip: number;
};

/** Clamp page/limit and compute skip for Prisma/SQL queries. */
export function normalizePagination(
  page?: number | string,
  limit?: number | string,
  maxLimit = 100,
  defaultLimit = 20,
): NormalizedPagination {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.max(1, Math.min(maxLimit, Number(limit) || defaultLimit));
  return { page: p, limit: l, skip: (p - 1) * l };
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return {
    data,
    total,
    page,
    limit,
    totalPages: total > 0 ? Math.ceil(total / limit) : 0,
  };
}

export function emptyPaginatedResponse<T>(limit = 20): PaginatedResponse<T> {
  return { data: [], total: 0, page: 1, limit, totalPages: 0 };
}
