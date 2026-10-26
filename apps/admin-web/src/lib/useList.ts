import { useEffect, useState } from 'react';

import { api, type PageMeta } from './api.js';

export interface ListFilters {
  [key: string]: string | undefined;
}

interface UseListResult<T> {
  rows: T[];
  meta?: PageMeta;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Standard list loader: always requests the newest entries first (the API
 * defaults to createdAt descending when no sort is supplied) with explicit
 * paging and optional filters. Values whose filters are empty are dropped.
 */
export function useList<T>(basePath: string, filters: ListFilters, page: number, limit: number): UseListResult<T> {
  const [rows, setRows] = useState<T[]>([]);
  const [meta, setMeta] = useState<PageMeta | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '') query.set(key, value);
    }

    const promise = api.body<T[]>(`${basePath}?${query.toString()}`);
    promise
      .then((body) => {
        if (cancelled) return;
        setRows(Array.isArray(body.data) ? body.data : []);
        setMeta(body.meta);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [basePath, page, limit, reloadKey, JSON.stringify(filters)]);

  const result = {
    rows,
    meta,
    loading,
    error,
    reload: () => setReloadKey((key) => key + 1),
  };
  return result;
}
