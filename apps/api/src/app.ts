import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { pinoHttp } from 'pino-http';
import helmet from 'helmet';

import { config } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler } from './core/middleware/errorHandler.js';
import { notFound } from './core/middleware/notFound.js';
import { globalLimiter } from './core/middleware/rateLimit.js';
import { requestContext } from './core/middleware/requestContext.js';
import { buildV1Router } from './index.js';
import { healthRouter } from './modules/health/health.routes.js';

/**
 * Express app assembly. Exported without `listen` so tests can mount it with
 * supertest.
 */
export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: config.WEB_ORIGIN, credentials: true }));
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req.headers['x-request-id'] as string | undefined) ?? req.id,
      autoLogging: { ignore: (req) => req.url === '/health' },
    }),
  );
  app.use(requestContext());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser(config.COOKIE_SECRET));
  app.use(globalLimiter);

  app.use('/', healthRouter);
  app.use('/api', healthRouter);
  app.use('/api/v1', buildV1Router());

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
