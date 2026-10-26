import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { permissionsFor } from '@ameen/domain';

import { AppError } from '../errors/AppError.js';
import { verifyAccessToken } from '../../modules/auth/strategies/jwt.js';

function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const [scheme, value] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value) return undefined;
  return value;
}

/** Requires a valid access token; attaches `req.user` with its permissions. */
export const authenticate: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) return next(AppError.unauthorized());

  try {
    const claims = verifyAccessToken(token);
    req.user = {
      id: claims.sub,
      role: claims.role,
      permissions: permissionsFor(claims.role),
    };
    return next();
  } catch {
    return next(AppError.unauthorized('Invalid or expired access token'));
  }
};

/** Attaches `req.user` when a valid token is present, but never rejects. */
export const optionalAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const claims = verifyAccessToken(token);
    req.user = {
      id: claims.sub,
      role: claims.role,
      permissions: permissionsFor(claims.role),
    };
  } catch {
    // Ignore — the route decides whether auth is required.
  }
  return next();
};
