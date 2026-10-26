import { z } from 'zod';

import { OTP_PURPOSES } from '../../config/constants.js';

export const ROLE_OPTIONS = ['admin', 'office_admin', 'production', 'inventory', 'dispatcher', 'driver', 'finance'] as const;
export const LOCALE_OPTIONS = ['en', 'ta', 'ml'] as const;

export const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Expected a 24-character ObjectId');

export const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, 'Expected an E.164 phone number, e.g. +919876543210');

export const requestOtpSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(OTP_PURPOSES).default('login'),
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(OTP_PURPOSES).default('login'),
  code: z.string().length(6, 'OTP must be 6 digits'),
});

export const registerSchema = z.object({
  phone: phoneSchema,
  code: z.string().length(6),
  businessName: z.string().min(1).max(160),
  name: z.string().min(1).max(120),
  email: z.string().email().optional(),
  gstin: z
    .string()
    .length(15)
    .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d[Z]{1}[A-Z\d]{1}$/)
    .optional(),
  locale: z.enum(['en', 'ta']).default('en'),
});

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(8).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8).max(128),
    newPassword: z.string().min(8).max(128),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: 'New password must differ from the current password',
    path: ['newPassword'],
  });

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  nameTa: z.string().max(120).optional(),
  email: z.string().email().optional(),
  locale: z.enum(LOCALE_OPTIONS).optional(),
});

export const inviteUserSchema = z.object({
  phone: phoneSchema,
  name: z.string().min(1).max(120),
  role: z.enum(ROLE_OPTIONS),
  locale: z.enum(LOCALE_OPTIONS).default('en'),
});

export const updateUserSchema = z.object({
  role: z.enum(ROLE_OPTIONS).optional(),
  status: z.enum(['active', 'invited', 'suspended', 'archived']).optional(),
});

export const idParamSchema = z.object({ id: objectIdSchema });
