import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { runWithRequestContext } from '../context/requestContext.js';

/** Assigns a request id and makes it available via AsyncLocalStorage. */
export function requestContext(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    runWithRequestContext({ requestId }, () => next());
  };
}
