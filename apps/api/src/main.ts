import { createApp } from './app.js';
import { config } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { logger } from './config/logger.js';
import { createSocketServer, wireEventBusToSocket } from './realtime/socket.js';

async function main() {
  await connectDatabase();
  await connectRedis();

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, 'API listening');
  });

  const io = createSocketServer(server);
  wireEventBusToSocket(io);

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'API shutting down');
    server.close();
    await io.close();
    await disconnectRedis();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  logger.error({ err: error }, 'API failed to start');
  process.exit(1);
});
