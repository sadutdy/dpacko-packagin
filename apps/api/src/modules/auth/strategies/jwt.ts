import { createHash, randomBytes } from 'node:crypto';

import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '@ameen/domain';

import { config } from '../../../config/env.js';

export interface AccessTokenClaims {
  sub: string;
  role: Role;
  type: 'access';
}

export function signAccessToken(claims: AccessTokenClaims): string {
  const options: SignOptions = {
    algorithm: 'RS256',
    expiresIn: config.JWT_ACCESS_TTL_SECONDS,
    subject: claims.sub,
  };
  return jwt.sign({ role: claims.role, type: 'access' }, config.JWT_PRIVATE_KEY, options);
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const decoded = jwt.verify(token, config.JWT_PUBLIC_KEY, { algorithms: ['RS256'] });

  if (typeof decoded === 'string') {
    throw new Error('Unexpected JWT payload');
  }

  const { role, type, sub } = decoded as Record<string, unknown>;

  if (typeof sub !== 'string' || typeof role !== 'string' || type !== 'access') {
    throw new Error('Malformed access token');
  }

  return { sub, role: role as Role, type: 'access' };
}

/** Opaque refresh token: 256 bits of randomness, URL-safe. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 of a token — refresh tokens are stored hashed, never plaintext. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
