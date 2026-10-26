import type { LoginResponse } from './auth.js';

const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
  }
}

async function parse(res: Response): Promise<unknown> {
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const error = (body?.error ?? {}) as { code?: string; message?: string };
    throw new ApiRequestError(error.message ?? res.statusText, error.code ?? 'ERROR', res.status);
  }
  return body?.data;
}

interface PagedBody<T> {
  data: T;
  meta?: PageMeta;
  error?: { code?: string; message?: string };
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface RequestInit {
  method: string;
  body?: unknown;
}

export const api = {
  async request(path: string, init: RequestInit): Promise<unknown> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const res = await fetch(`${API_URL}${path}`, {
      method: init.method,
      headers,
      credentials: 'include',
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });

    return parse(res);
  },

  /** Returns the full envelope so callers can read pagination metadata. */
  async body<T>(path: string): Promise<PagedBody<T>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const res = await fetch(`${API_URL}${path}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    const text = await res.text();
    const body = text ? (JSON.parse(text) as PagedBody<T>) : ({} as PagedBody<T>);
    if (!res.ok) {
      const error = (body.error ?? {}) as { code?: string; message?: string };
      throw new ApiRequestError(error.message ?? res.statusText, error.code ?? 'ERROR', res.status);
    }
    return body;
  },

  /** Fetches a list endpoint and returns its rows plus pagination meta (if any). */
  async list<T>(path: string): Promise<T[]> {
    const body = await this.body<T[]>(path);
    return Array.isArray(body.data) ? body.data : [];
  },

  async get<T>(path: string): Promise<T> {
    return (await this.request(path, { method: 'GET' })) as T;
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    return (await this.request(path, { method: 'POST', body })) as T;
  },

  async put<T>(path: string, body?: unknown): Promise<T> {
    return (await this.request(path, { method: 'PUT', body })) as T;
  },

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return (await this.request(path, { method: 'PATCH', body })) as T;
  },

  async del<T>(path: string): Promise<T> {
    return (await this.request(path, { method: 'DELETE' })) as T;
  },
};

/** Exchanges the HttpOnly refresh cookie for a fresh in-memory access token. */
export async function refreshSession(): Promise<void> {
  const data = await api.post<{ accessToken: string }>('/api/v1/auth/refresh', {});
  setAccessToken(data.accessToken);
}

export async function login(phone: string, password: string): Promise<LoginResponse> {
  const data = await api.post<LoginResponse>('/api/v1/auth/login', { phone, password });
  setAccessToken(data.accessToken);
  return data;
}
