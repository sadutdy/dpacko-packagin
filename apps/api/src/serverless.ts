import type { IncomingMessage, ServerResponse } from 'node:http';

import { createApp } from './app.js';
import { connectDatabase } from './config/db.js';
import { logger } from './config/logger.js';
import { connectRedis } from './config/redis.js';

/**
 * Vercel entry. Connections are opened once per warm instance and reused.
 * Redis is best-effort here: the API still serves requests when it is down.
 * Workers (BullMQ) and Socket.IO do not run in this runtime.
 */
let app: ReturnType<typeof createApp> | undefined;
let ready: Promise<void> | undefined;

async function init(): Promise<void> {
  await connectDatabase();
  await connectRedis().catch((error) => logger.error({ err: error }, 'Redis unavailable'));
  app = createApp();
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  ready ??= init().catch((error) => {
    ready = undefined;
    throw error;
  });
  try {
    await ready;
  } catch (error) {
    logger.error({ err: error }, 'API failed to initialise');
    res.statusCode = 503;
    res.setHeader('content-type', 'application/problem+json');
    res.end(JSON.stringify({ title: 'Service unavailable', status: 503 }));
    return;
  }
  app?.(req as never, res as never);
}
