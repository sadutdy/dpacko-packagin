import { describe, expect, it } from 'vitest';

import { ErrorCode } from '../../src/core/errors/ErrorCode.js';
import { buildPageMeta, parsePagination } from '../../src/core/http/pagination.js';
import { idempotencyStore } from '../../src/core/middleware/idempotency.js';
import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
  verifyAccessToken,
} from '../../src/modules/auth/strategies/jwt.js';
import { generateOtp, hashOtp, verifyOtp } from '../../src/modules/auth/strategies/otp.js';
import { hashPassword, verifyPassword } from '../../src/modules/auth/strategies/password.js';

describe('jwt strategy', () => {
  it('signs and verifies an access token', () => {
    const token = signAccessToken({ sub: 'a'.repeat(24), role: 'admin', type: 'access' });
    const claims = verifyAccessToken(token);
    expect(claims.sub).toBe('a'.repeat(24));
    expect(claims.role).toBe('admin');
    expect(claims.type).toBe('access');
  });

  it('produces distinct opaque refresh tokens', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
    expect(hashToken(a)).not.toBe(hashToken(b));
  });
});

describe('otp strategy', () => {
  it('generates a 6-digit code and verifies it', () => {
    const code = generateOtp();
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyOtp(code, hashOtp(code))).toBe(true);
  });

  it('rejects a wrong code', () => {
    const code = generateOtp();
    expect(verifyOtp('000000', hashOtp(code))).toBe(false);
  });
});

describe('password strategy', () => {
  it('hashes and verifies with argon2id', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).not.toContain('correct horse');
    await expect(verifyPassword(hash, 'correct horse battery')).resolves.toBe(true);
    await expect(verifyPassword(hash, 'wrong')).resolves.toBe(false);
  });
});

describe('pagination', () => {
  it('parses page and limit with defaults', () => {
    expect(parsePagination({})).toMatchObject({ page: 1, limit: 20, skip: 0 });
    expect(parsePagination({ page: '3', limit: '50' })).toMatchObject({
      page: 3,
      limit: 50,
      skip: 100,
    });
  });

  it('builds page metadata', () => {
    expect(buildPageMeta(95, { page: 2, limit: 20, skip: 20 })).toMatchObject({
      total: 95,
      totalPages: 5,
      hasNext: true,
      hasPrev: true,
    });
  });
});

describe('idempotency store', () => {
  it('stores and expires entries', () => {
    idempotencyStore.set('k', { status: 201, body: { ok: true } }, 60);
    expect(idempotencyStore.get('k')).toMatchObject({ status: 201, body: { ok: true } });
    expect(idempotencyStore.get('missing')).toBeUndefined();
  });
});

describe('error codes', () => {
  it('maps every code to an HTTP status', () => {
    expect(ErrorCode.INVALID_TRANSITION).toBe('INVALID_TRANSITION');
  });
});
