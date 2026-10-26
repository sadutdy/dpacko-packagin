import type { NextFunction, Request, RequestHandler, Response } from 'express';

interface StoredResponse {
  status: number;
  body: unknown;
  expiresAt: number;
}

/**
 * In-process idempotency store. Production uses Redis so a retried write is a
 * no-op across instances. Keys are scoped to the caller and the request.
 */
class IdempotencyStore {
  private readonly entries = new Map<string, StoredResponse>();

  get(key: string): StoredResponse | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  set(key: string, value: Omit<StoredResponse, 'expiresAt'>, ttlSeconds = 24 * 60 * 60): void {
    this.entries.set(key, { ...value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

export const idempotencyStore = new IdempotencyStore();

/**
 * Replays a cached response when the same `Idempotency-Key` is replayed. The
 * response body is captured by wrapping `res.json`.
 */
export function idempotency(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.header('Idempotency-Key');
    if (!key) return next();

    const cacheKey = `${req.user?.id ?? 'anon'}:${req.method}:${req.originalUrl}:${key}`;
    const hit = idempotencyStore.get(cacheKey);
    if (hit) {
      res.setHeader('Idempotency-Replayed', 'true');
      res.status(hit.status).json(hit.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode < 400) {
        idempotencyStore.set(cacheKey, { status: res.statusCode, body });
      }
      return originalJson(body);
    };

    return next();
  };
}
