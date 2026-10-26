import type { AppError } from './AppError.js';

/** RFC 7807 problem+json envelope, the single error shape for the API. */
export function toProblem(error: AppError): Record<string, unknown> {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.messageTa ? { messageTa: error.messageTa } : {}),
      ...(error.details ? { details: error.details } : {}),
      ...(error.requestId ? { requestId: error.requestId } : {}),
      timestamp: error.timestamp,
    },
  };
}
