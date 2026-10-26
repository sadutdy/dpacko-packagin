import type { Request, RequestHandler, Response } from 'express';

import { config } from '../../config/env.js';
import { ACCESS_TOKEN_COOKIE } from '../../config/constants.js';
import { asyncHandler } from '../../core/http/asyncHandler.js';
import { ok } from '../../core/http/apiResponse.js';
import { hashToken } from './strategies/jwt.js';
import { authService } from './auth.service.js';

function meta(req: Request) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

function setRefreshCookie(res: Response, refreshToken: string) {
  res.cookie(ACCESS_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: config.JWT_REFRESH_TTL_SECONDS * 1000,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/api/v1/auth' });
}

function tokenResponse(
  req: Request,
  res: Response,
  result: {
    user: unknown;
    tokens: { accessToken: string; refreshToken: string; tokenType: 'Bearer'; expiresIn: number };
  },
  status = 200,
) {
  setRefreshCookie(res, result.tokens.refreshToken);
  return res.status(status).json({
    data: {
      user: result.user,
      accessToken: result.tokens.accessToken,
      tokenType: result.tokens.tokenType,
      expiresIn: result.tokens.expiresIn,
    },
  });
}

export const authController: {
  requestOtp: RequestHandler;
  verifyOtp: RequestHandler;
  register: RequestHandler;
  login: RequestHandler;
  refresh: RequestHandler;
  logout: RequestHandler;
  logoutAll: RequestHandler;
  me: RequestHandler;
  updateMe: RequestHandler;
  changePassword: RequestHandler;
  sessions: RequestHandler;
} = {
  requestOtp: asyncHandler(async (req, res) => {
    const { phone, purpose } = req.valid?.body as { phone: string; purpose: string };
    const result = await authService.requestOtp(phone, purpose);
    return ok(res, result);
  }),

  verifyOtp: asyncHandler(async (req, res) => {
    const { phone, purpose, code } = req.valid?.body as {
      phone: string;
      purpose: string;
      code: string;
    };
    const result = await authService.verifyOtp(phone, purpose, code, meta(req));
    return tokenResponse(req, res, result);
  }),

  register: asyncHandler(async (req, res) => {
    const body = req.valid?.body as Record<string, unknown>;
    const result = await authService.register(body as never, meta(req));
    return tokenResponse(req, res, result, 201);
  }),

  login: asyncHandler(async (req, res) => {
    const { phone, password } = req.valid?.body as { phone: string; password: string };
    const result = await authService.login(phone, password, meta(req));
    return tokenResponse(req, res, result);
  }),

  refresh: asyncHandler(async (req, res) => {
    const cookieToken = req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined;
    const { refreshToken } = req.valid?.body as { refreshToken: string };
    const token = refreshToken ?? cookieToken;
    if (!token) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing refresh token' } });
      return;
    }
    const tokens = await authService.refresh(token, meta(req));
    return tokenResponse(req, res, { user: null, tokens });
  }),

  logout: asyncHandler(async (req, res) => {
    const cookieToken = req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined;
    const { refreshToken } = req.valid?.body as { refreshToken?: string };
    await authService.logout(refreshToken ?? cookieToken ?? '');
    clearRefreshCookie(res);
    return ok(res, { revoked: true });
  }),

  logoutAll: asyncHandler(async (req, res) => {
    await authService.logoutAll(req.user!.id);
    clearRefreshCookie(res);
    return ok(res, { revoked: true });
  }),

  me: asyncHandler(async (req, res) => {
    const user = await authService.getProfile(req.user!.id);
    return ok(res, user);
  }),

  updateMe: asyncHandler(async (req, res) => {
    const user = await authService.updateProfile(req.user!.id, req.valid?.body as never);
    return ok(res, user);
  }),

  changePassword: asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.valid?.body as {
      currentPassword: string;
      newPassword: string;
    };
    await authService.changePassword(req.user!.id, currentPassword, newPassword);
    clearRefreshCookie(res);
    return ok(res, { changed: true });
  }),

  sessions: asyncHandler(async (req, res) => {
    const cookieToken = req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined;
    const currentHash = cookieToken ? hashToken(cookieToken) : undefined;
    const sessions = await authService.listSessions(req.user!.id, currentHash);
    return ok(res, sessions);
  }),
};
