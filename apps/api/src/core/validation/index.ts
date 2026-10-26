import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny } from 'zod';

import { AppError } from '../errors/AppError.js';
import { getRequestId } from '../context/requestContext.js';

export type ValidationSource = 'body' | 'query' | 'params' | 'headers';

/**
 * Parses `req[source]` with a zod schema and stores the result on `req.valid`.
 * Unknown keys are stripped by zod. Controllers never touch `req.body` directly.
 */
export function validate(schema: ZodTypeAny, source: ValidationSource = 'body'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      next(AppError.validation('Request validation failed', { issues: details }, getRequestId()));
      return;
    }

    req.valid = { ...(req.valid ?? {}), [source]: result.data };
    next();
  };
}
