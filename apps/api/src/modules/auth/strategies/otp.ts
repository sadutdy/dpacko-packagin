import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/** Constant-time comparison so OTP guessing cannot be timed. */
export function verifyOtp(code: string, codeHash: string): boolean {
  const candidate = Buffer.from(hashOtp(code), 'hex');
  const stored = Buffer.from(codeHash, 'hex');
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}
