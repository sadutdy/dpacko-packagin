import { Redis } from 'ioredis';

import { config } from './env.js';
import { logger } from './logger.js';

let client: Redis | undefined;

/** Shared Redis connection for caching, rate limits and BullMQ. */
export function getRedis(): Redis {
  if (!client) {
    client = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    client.on('error', (error) => logger.error({ err: error }, 'Redis error'));
  }
  return client;
}

export async function connectRedis(): Promise<Redis> {
  const redis = getRedis();
  if (redis.status === 'wait') await redis.connect();
  return redis;
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = undefined;
  }
}

export function isRedisConnected(): boolean {
  return client?.status === 'ready';
}
