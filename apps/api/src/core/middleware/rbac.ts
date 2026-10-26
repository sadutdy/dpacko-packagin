import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Permission, Role } from '@ameen/domain';

import { AppError } from '../errors/AppError.js';

/** Requires the caller to hold every listed permission. */
export function requirePermission(...permissions: Permission[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    const held = new Set(req.user.permissions);
    if (!permissions.every((permission) => held.has(permission))) {
      return next(AppError.forbidden());
    }
    return next();
  };
}

/** Requires the caller to hold one of the listed roles. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden());
    return next();
  };
}
