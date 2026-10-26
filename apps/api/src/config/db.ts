import mongoose from 'mongoose';

import { config } from './env.js';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);

let connected = false;

export async function connectDatabase(uri: string = config.MONGO_URI): Promise<typeof mongoose> {
  if (connected) return mongoose;

  mongoose.connection.on('error', (error) => {
    logger.error({ err: error }, 'Mongo connection error');
  });
  mongoose.connection.on('disconnected', () => {
    connected = false;
    logger.warn('Mongo disconnected');
  });

  await mongoose.connect(uri, { dbName: config.MONGO_DB_NAME, autoIndex: !config.isProduction });
  connected = true;
  logger.info({ uri: uri.replace(/\/\/.*@/, '//<redacted>@') }, 'Mongo connected');
  return mongoose;
}

export async function disconnectDatabase(): Promise<void> {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
