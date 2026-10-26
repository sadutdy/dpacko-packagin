/**
 * Pure domain errors. These carry no HTTP knowledge so `packages/domain` stays
 * free of transport concerns. The API maps a `DomainError` onto its `AppError`
 * envelope at the boundary.
 */
export const DomainErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  INVALID_PRODUCTION_STAGE: 'INVALID_PRODUCTION_STAGE',
  CREDIT_LIMIT_EXCEEDED: 'CREDIT_LIMIT_EXCEEDED',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  INVALID_PRICING: 'INVALID_PRICING',
  NOT_DELEGATED: 'NOT_DELEGATED',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
} as const;

export type DomainErrorCode = (typeof DomainErrorCode)[keyof typeof DomainErrorCode];

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: DomainErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

export function isDomainError(value: unknown): value is DomainError {
  return value instanceof DomainError;
}
