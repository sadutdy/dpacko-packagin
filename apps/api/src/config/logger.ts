import { pino } from 'pino';

import { config } from './env.js';

export const logger = pino({
  level: config.LOG_LEVEL,
  base: { service: 'ameen-api' },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.codeHash'],
    remove: true,
  },
});

/** Creates a child logger bound to a request id. */
export function requestLogger(requestId: string) {
  return logger.child({ requestId });
}
