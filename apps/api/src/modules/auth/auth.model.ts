import { Schema, model } from 'mongoose';

import { OTP_PURPOSES, USER_ROLES } from '../../config/constants.js';

const { ObjectId } = Schema.Types;

/**
 * Users — the primary login identity is the phone number (E.164). Passwords are
 * optional because customer accounts may be OTP-only.
 */
const userSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    email: { type: String, unique: true, sparse: true },
    passwordHash: { type: String, default: null },
    name: { type: String, default: '' },
    nameTa: { type: String, default: '' },
    role: { type: String, enum: USER_ROLES, required: true, default: 'customer', index: true },
    status: {
      type: String,
      enum: ['active', 'invited', 'suspended', 'archived'],
      required: true,
      default: 'active',
      index: true,
    },
    customerId: { type: ObjectId, ref: 'Customer', default: null },
    driverId: { type: ObjectId, ref: 'Driver', default: null },
    mfaEnabled: { type: Boolean, default: false },
    locale: { type: String, enum: ['en', 'ta'], default: 'en' },
    lastLoginAt: { type: Date, default: null },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const User = model('User', userSchema);

/** OTP codes — hashed, 5-minute TTL, max 5 attempts. */
const otpSchema = new Schema(
  {
    phone: { type: String, required: true, index: true },
    purpose: { type: String, enum: OTP_PURPOSES, required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    consumedAt: { type: Date, default: null },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

otpSchema.index({ phone: 1, purpose: 1 });

export const OtpCode = model('OtpCode', otpSchema);

/** Refresh tokens — opaque, stored hashed, rotated on use. */
const refreshTokenSchema = new Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    revokedAt: { type: Date, default: null },
    replacedByHash: { type: String, default: null },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const RefreshToken = model('RefreshToken', refreshTokenSchema);
