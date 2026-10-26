import { Role } from '@ameen/domain';

export const ACCESS_TOKEN_COOKIE = 'ameen_refresh';
export const IDEMPOTENCY_RETRIES = 24;

export const USER_ROLES = [
  Role.Admin,
  Role.Customer,
  Role.Production,
  Role.Inventory,
  Role.Dispatcher,
  Role.Driver,
  Role.Finance,
  Role.OfficeAdmin,
] as const;

export const OTP_PURPOSES = [
  'login',
  'register',
  'reset_password',
  'delivery_otp',
  'verify_pod',
] as const;

export const OTP_TTL_SECONDS = 300;
export const OTP_MAX_ATTEMPTS = 5;

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 200;

export const FINANCIAL_YEAR = '25-26';
