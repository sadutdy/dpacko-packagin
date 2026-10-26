import type { Response } from 'express';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ data });
}

export function created<T>(res: Response, data: T): Response {
  return res.status(201).json({ data });
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}

export function paginated<T>(res: Response, data: T[], meta: PageMeta): Response {
  return res.status(200).json({ data, meta });
}
