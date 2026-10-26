import { logger } from './config/logger.js';
import { connectDatabase } from './config/db.js';
import { connectRedis } from './config/redis.js';
import { startWorker } from './jobs/worker.js';

async function main() {
  await connectDatabase();
  await connectRedis();
  const workers = await startWorker();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'worker shutting down');
    await Promise.all(workers.map((worker) => worker.close()));
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  logger.error({ err: error }, 'Worker failed to start');
  process.exit(1);
});
