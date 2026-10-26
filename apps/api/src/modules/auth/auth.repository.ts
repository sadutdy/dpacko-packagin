import { Types } from 'mongoose';
import type { FilterQuery, HydratedDocument } from 'mongoose';

import { OtpCode, RefreshToken, User } from './auth.model.js';

export type UserDoc = HydratedDocument<
  {
    phone: string;
    email?: string;
    passwordHash?: string | null;
    name: string;
    nameTa: string;
    role: string;
    status: string;
    customerId?: Types.ObjectId | null;
    driverId?: Types.ObjectId | null;
    mfaEnabled: boolean;
    locale: string;
    lastLoginAt?: Date | null;
    failedLoginAttempts: number;
    lockedUntil?: Date | null;
  },
  { createdAt: Date; updatedAt: Date }
>;

export type OtpDoc = HydratedDocument<{
  phone: string;
  purpose: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt?: Date | null;
}>;

export type RefreshTokenDoc = HydratedDocument<{
  userId: Types.ObjectId;
  tokenHash: string;
  family: string;
  userAgent: string;
  ip: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  replacedByHash?: string | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export interface CreateUserInput {
  phone: string;
  email?: string;
  passwordHash?: string;
  name: string;
  nameTa?: string;
  role: string;
  status?: string;
  locale?: string;
  customerId?: Types.ObjectId;
}

export const userRepository = {
  toId(id: string | Types.ObjectId): Types.ObjectId {
    return typeof id === 'string' ? new Types.ObjectId(id) : id;
  },

  async create(input: CreateUserInput): Promise<UserDoc> {
    const [user] = await User.create([input]);
    return user as UserDoc;
  },

  findByPhone(phone: string): Promise<UserDoc | null> {
    return User.findOne({ phone }).exec() as Promise<UserDoc | null>;
  },

  findById(id: string | Types.ObjectId): Promise<UserDoc | null> {
    return User.findById(id).exec() as Promise<UserDoc | null>;
  },

  async update(
    id: string | Types.ObjectId,
    update: Partial<CreateUserInput>,
  ): Promise<UserDoc | null> {
    return User.findByIdAndUpdate(id, update, { new: true }).exec() as Promise<UserDoc | null>;
  },

  list(filter: FilterQuery<unknown>, skip: number, limit: number, sort?: string) {
    const query = User.find(filter).skip(skip).limit(limit);
    if (sort) query.sort(sort);
    else query.sort({ createdAt: -1 });
    return query.exec() as Promise<UserDoc[]>;
  },

  count(filter: FilterQuery<unknown>): Promise<number> {
    return User.countDocuments(filter).exec();
  },

  listByRoles(roles: readonly string[]) {
    return User.find({ role: { $in: [...roles] } })
      .sort({ createdAt: 1 })
      .exec() as Promise<UserDoc[]>;
  },

  touchLastLogin(id: string | Types.ObjectId): Promise<void> {
    return User.findByIdAndUpdate(id, {
      lastLoginAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    }).then(() => undefined);
  },

  setLock(id: string | Types.ObjectId, attempts: number, lockedUntil: Date | null) {
    return User.findByIdAndUpdate(id, { failedLoginAttempts: attempts, lockedUntil }).then(
      () => undefined,
    );
  },
};

export const otpRepository = {
  async create(input: {
    phone: string;
    purpose: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<OtpDoc> {
    await OtpCode.deleteMany({ phone: input.phone, purpose: input.purpose }).exec();
    const [doc] = await OtpCode.create([input]);
    return doc as OtpDoc;
  },

  findActive(phone: string, purpose: string): Promise<OtpDoc | null> {
    return OtpCode.findOne({
      phone,
      purpose,
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    }).exec() as Promise<OtpDoc | null>;
  },

  async incrementAttempts(id: Types.ObjectId): Promise<void> {
    await OtpCode.findByIdAndUpdate(id, { $inc: { attempts: 1 } }).exec();
  },

  async consume(id: Types.ObjectId): Promise<void> {
    await OtpCode.findByIdAndUpdate(id, { consumedAt: new Date() }).exec();
  },
};

export const refreshTokenRepository = {
  async create(input: {
    userId: Types.ObjectId;
    tokenHash: string;
    family: string;
    userAgent: string;
    ip: string;
    expiresAt: Date;
  }): Promise<RefreshTokenDoc> {
    const [doc] = await RefreshToken.create([input]);
    return doc as RefreshTokenDoc;
  },

  findByHash(tokenHash: string): Promise<RefreshTokenDoc | null> {
    return RefreshToken.findOne({ tokenHash }).exec() as Promise<RefreshTokenDoc | null>;
  },

  async revoke(id: Types.ObjectId, replacedByHash?: string): Promise<void> {
    await RefreshToken.findByIdAndUpdate(id, {
      revokedAt: new Date(),
      replacedByHash: replacedByHash ?? null,
    }).exec();
  },

  async revokeFamily(family: string): Promise<void> {
    await RefreshToken.updateMany({ family, revokedAt: null }, { revokedAt: new Date() }).exec();
  },

  async revokeAllForUser(userId: Types.ObjectId): Promise<void> {
    await RefreshToken.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() }).exec();
  },

  listActive(userId: Types.ObjectId): Promise<RefreshTokenDoc[]> {
    return RefreshToken.find({
      userId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .exec() as Promise<RefreshTokenDoc[]>;
  },
};
