import { z } from 'zod';

import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../../config/constants.js';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
  sort: z.string().optional(),
});

export interface PageParams {
  page: number;
  limit: number;
  skip: number;
  sort?: string;
}

export function parsePagination(query: unknown): PageParams {
  const parsed = paginationSchema.parse(query);
  return {
    page: parsed.page,
    limit: parsed.limit,
    skip: (parsed.page - 1) * parsed.limit,
    sort: parsed.sort,
  };
}

export function buildPageMeta(total: number, params: PageParams) {
  return {
    page: params.page,
    limit: params.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
    hasNext: params.page * params.limit < total,
    hasPrev: params.page > 1,
  };
}
