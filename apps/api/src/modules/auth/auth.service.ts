import { randomBytes } from 'node:crypto';

import { permissionsFor, type Permission, type Role } from '@ameen/domain';

import { config } from '../../config/env.js';
import { OTP_MAX_ATTEMPTS, OTP_TTL_SECONDS } from '../../config/constants.js';
import { AppError } from '../../core/errors/AppError.js';
import { addMinutes, addSeconds, now } from '../../core/utils/dates.js';
import { sendOtp } from '../notifications/otpNotifier.js';
import { generateRefreshToken, hashToken, signAccessToken } from './strategies/jwt.js';
import { generateOtp, hashOtp, verifyOtp } from './strategies/otp.js';
import { hashPassword, verifyPassword } from './strategies/password.js';
import {
  otpRepository,
  refreshTokenRepository,
  userRepository,
  type UserDoc,
} from './auth.repository.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface PublicUser {
  id: string;
  phone: string;
  email?: string;
  name: string;
  nameTa: string;
  role: Role;
  status: string;
  locale: string;
  permissions: Permission[];
  customerId?: string;
  driverId?: string;
  lastLoginAt?: string | null;
}

export interface SessionInfo {
  id: string;
  userAgent: string;
  ip: string;
  createdAt: string;
  lastActiveAt: string;
  current: boolean;
}

export function toPublicUser(user: UserDoc): PublicUser {
  return {
    id: String(user._id),
    phone: user.phone,
    email: user.email ?? undefined,
    name: user.name,
    nameTa: user.nameTa,
    role: user.role as Role,
    status: user.status,
    locale: user.locale,
    permissions: [...permissionsFor(user.role as Role)],
    customerId: user.customerId ? String(user.customerId) : undefined,
    driverId: user.driverId ? String(user.driverId) : undefined,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
  };
}

interface RequestMeta {
  userAgent?: string;
  ip?: string;
}

async function issueTokens(user: UserDoc, meta: RequestMeta): Promise<AuthTokens> {
  const accessToken = signAccessToken({
    sub: String(user._id),
    role: user.role as Role,
    type: 'access',
  });

  const refreshToken = generateRefreshToken();
  const family = randomBytes(16).toString('hex');
  const expiresAt = addSeconds(now(), config.JWT_REFRESH_TTL_SECONDS);

  await refreshTokenRepository.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    family,
    userAgent: meta.userAgent ?? '',
    ip: meta.ip ?? '',
    expiresAt,
  });

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: config.JWT_ACCESS_TTL_SECONDS,
  };
}

async function assertAccountUsable(user: UserDoc | null): Promise<UserDoc> {
  if (!user) throw AppError.unauthorized('Invalid credentials');
  if (user.status === 'suspended') throw AppError.forbidden('Account suspended');
  if (user.status === 'archived') throw AppError.forbidden('Account archived');
  return user;
}

export const authService = {
  async requestOtp(phone: string, purpose: string) {
    const code = generateOtp();
    await otpRepository.create({
      phone,
      purpose,
      codeHash: hashOtp(code),
      expiresAt: addSeconds(now(), OTP_TTL_SECONDS),
    });
    await sendOtp(phone, code, purpose);

    return {
      sent: true,
      expiresInSeconds: OTP_TTL_SECONDS,
      ...(config.ENABLE_OTP_AUTOLOGIN ? { devCode: code } : {}),
    };
  },

  async verifyOtp(phone: string, purpose: string, code: string, meta: RequestMeta) {
    const otp = await otpRepository.findActive(phone, purpose);
    if (!otp) throw AppError.validation('No active OTP found. Request a new code.');
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw AppError.validation('Too many attempts. Request a new code.');
    }
    if (!verifyOtp(code, otp.codeHash)) {
      await otpRepository.incrementAttempts(otp._id);
      throw AppError.unauthorized('Invalid OTP');
    }
    await otpRepository.consume(otp._id);

    const user = await assertAccountUsable(await userRepository.findByPhone(phone));
    await userRepository.touchLastLogin(user._id);
    const tokens = await issueTokens(user, meta);
    return { user: toPublicUser(user), tokens };
  },

  async register(
    input: {
      phone: string;
      code: string;
      businessName: string;
      name: string;
      email?: string;
      gstin?: string;
      locale: 'en' | 'ta';
    },
    meta: RequestMeta,
  ) {
    const otp = await otpRepository.findActive(input.phone, 'register');
    if (!otp) throw AppError.validation('No active OTP found. Request a new code.');
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw AppError.validation('Too many attempts. Request a new code.');
    }
    if (!verifyOtp(input.code, otp.codeHash)) {
      await otpRepository.incrementAttempts(otp._id);
      throw AppError.unauthorized('Invalid OTP');
    }

    const existing = await userRepository.findByPhone(input.phone);
    if (existing) throw AppError.conflict('An account with this number already exists');

    await otpRepository.consume(otp._id);

    const user = await userRepository.create({
      phone: input.phone,
      email: input.email,
      name: input.name,
      role: 'customer',
      status: 'active',
      locale: input.locale,
    });
    await userRepository.touchLastLogin(user._id);

    const tokens = await issueTokens(user, meta);
    return { user: toPublicUser(user), tokens };
  },

  async login(phone: string, password: string, meta: RequestMeta) {
    const user = await userRepository.findByPhone(phone);
    if (!user || !user.passwordHash) throw AppError.unauthorized('Invalid credentials');

    if (user.lockedUntil && user.lockedUntil > now()) {
      throw AppError.forbidden('Account temporarily locked. Try again later.');
    }

    if (!(await verifyPassword(user.passwordHash, password))) {
      const attempts = user.failedLoginAttempts + 1;
      const lockedUntil = attempts >= 5 ? addMinutes(now(), 15) : null;
      await userRepository.setLock(user._id, attempts, lockedUntil);
      throw AppError.unauthorized('Invalid credentials');
    }

    await userRepository.touchLastLogin(user._id);
    const tokens = await issueTokens(user, meta);
    return { user: toPublicUser(user), tokens };
  },

  async refresh(refreshToken: string, meta: RequestMeta): Promise<AuthTokens> {
    const doc = await refreshTokenRepository.findByHash(hashToken(refreshToken));
    if (!doc) throw AppError.unauthorized('Invalid refresh token');

    if (doc.revokedAt || doc.expiresAt <= now()) {
      // Reuse of a rotated token means theft — revoke the whole family.
      if (doc.revokedAt) await refreshTokenRepository.revokeFamily(doc.family);
      throw AppError.unauthorized('Invalid refresh token');
    }

    const user = await assertAccountUsable(await userRepository.findById(doc.userId));

    const next = generateRefreshToken();
    const expiresAt = addSeconds(now(), config.JWT_REFRESH_TTL_SECONDS);
    await refreshTokenRepository.revoke(doc._id, hashToken(next));
    await refreshTokenRepository.create({
      userId: user._id,
      tokenHash: hashToken(next),
      family: doc.family,
      userAgent: meta.userAgent ?? '',
      ip: meta.ip ?? '',
      expiresAt,
    });

    return {
      accessToken: signAccessToken({
        sub: String(user._id),
        role: user.role as Role,
        type: 'access',
      }),
      refreshToken: next,
      tokenType: 'Bearer',
      expiresIn: config.JWT_ACCESS_TTL_SECONDS,
    };
  },

  async logout(refreshToken: string): Promise<void> {
    const doc = await refreshTokenRepository.findByHash(hashToken(refreshToken));
    if (doc && !doc.revokedAt) await refreshTokenRepository.revoke(doc._id);
  },

  async logoutAll(userId: string): Promise<void> {
    await refreshTokenRepository.revokeAllForUser(userRepository.toId(userId));
  },

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await assertAccountUsable(await userRepository.findById(userId));
    return toPublicUser(user);
  },

  async updateProfile(
    userId: string,
    input: { name?: string; nameTa?: string; email?: string; locale?: 'en' | 'ta' },
  ): Promise<PublicUser> {
    const update: Record<string, unknown> = {};
    if (input.name !== undefined) update.name = input.name;
    if (input.nameTa !== undefined) update.nameTa = input.nameTa;
    if (input.email !== undefined) update.email = input.email;
    if (input.locale !== undefined) update.locale = input.locale;

    const user = await userRepository.update(userId, update);
    return toPublicUser(await assertAccountUsable(user));
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await userRepository.findById(userId);
    await assertAccountUsable(user);
    if (!user!.passwordHash || !(await verifyPassword(user!.passwordHash, currentPassword))) {
      throw AppError.unauthorized('Current password is incorrect');
    }
    await userRepository.update(userId, { passwordHash: await hashPassword(newPassword) });
    await refreshTokenRepository.revokeAllForUser(user!._id);
  },

  async listSessions(userId: string, currentTokenHash?: string): Promise<SessionInfo[]> {
    const sessions = await refreshTokenRepository.listActive(userRepository.toId(userId));
    return sessions.map((session) => ({
      id: String(session._id),
      userAgent: session.userAgent,
      ip: session.ip,
      createdAt: session.createdAt.toISOString(),
      lastActiveAt: session.updatedAt.toISOString(),
      current: session.tokenHash === currentTokenHash,
    }));
  },
};
