import { createHash } from 'node:crypto';

import { isValidObjectId, Types } from 'mongoose';

export function toObjectId(value: string): Types.ObjectId {
  return new Types.ObjectId(value);
}

export function isObjectId(value: string): boolean {
  return isValidObjectId(value);
}

/** Deterministic short id, useful for idempotency keys and logs. */
export function shortHash(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 16);
}
