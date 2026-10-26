import rateLimit from 'express-rate-limit';

import { config } from '../../config/env.js';

interface LimiterOptions {
  windowMs: number;
  limit: number;
  message?: string;
}

/**
 * Rate limiter factory. Uses the in-process store for now; the production
 * deployment swaps in a Redis store so limits are shared across instances.
 */
export function createRateLimiter({ windowMs, limit, message }: LimiterOptions) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => config.isTest,
    handler: (_req, res) => {
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: message ?? 'Too many requests, try again later' },
      });
    },
  });
}

export const globalLimiter = createRateLimiter({ windowMs: 60_000, limit: 300 });
export const authLimiter = createRateLimiter({ windowMs: 15 * 60_000, limit: 30 });
export const otpLimiter = createRateLimiter({
  windowMs: 60_000,
  limit: 3,
  message: 'Too many OTP requests, try again in a minute',
});
