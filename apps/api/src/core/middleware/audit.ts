import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { auditService } from '../../modules/audit/audit.service.js';

/**
 * Records an audit entry after a successful response. The response body is
 * captured by wrapping `res.json`; `res.locals.auditBefore` may be set by the
 * handler to record the pre-change state.
 */
export function audit(action: string, entityType: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = (body: unknown) => {
      if (res.statusCode < 400 && req.user) {
        void auditService.record({
          actorId: req.user.id,
          actorRole: req.user.role,
          action,
          entityType,
          entityId: req.params.id,
          before: res.locals.auditBefore,
          after: (body as { data?: unknown } | null)?.data,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          requestId: req.requestId,
        });
      }
      return originalJson(body);
    };

    return next();
  };
}
