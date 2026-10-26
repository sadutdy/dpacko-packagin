import { Router } from 'express';

import { isDatabaseConnected } from '../../config/db.js';
import { isRedisConnected } from '../../config/redis.js';
import { asyncHandler } from '../../core/http/asyncHandler.js';

export const healthRouter: Router = Router();

function snapshot() {
  const mongo = isDatabaseConnected();
  const redis = isRedisConnected();
  return {
    status: mongo && redis ? 'ok' : 'degraded',
    time: new Date().toISOString(),
    dependencies: { mongo, redis },
  };
}

healthRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const body = snapshot();
    res.status(body.status === 'ok' ? 200 : 503).json({ data: body });
  }),
);

healthRouter.get(
  '/health/ready',
  asyncHandler(async (_req, res) => {
    const body = snapshot();
    res.status(body.status === 'ok' ? 200 : 503).json({ data: body });
  }),
);
