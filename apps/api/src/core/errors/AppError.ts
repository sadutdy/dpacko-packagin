import { ErrorCode, ERROR_STATUS } from './ErrorCode.js';

export interface AppErrorDetails {
  allowedTransitions?: string[];
  [key: string]: unknown;
}

/**
 * The one error shape for the whole API. `messageTa` carries the Tamil text so
 * the UI can render a localized error without a code change.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly messageTa?: string;
  readonly details?: AppErrorDetails;
  readonly requestId?: string;
  readonly timestamp: string;

  constructor(options: {
    code: ErrorCode;
    message: string;
    messageTa?: string;
    details?: AppErrorDetails;
    requestId?: string;
    cause?: unknown;
  }) {
    super(options.message);
    this.name = 'AppError';
    this.code = options.code;
    this.status = ERROR_STATUS[options.code];
    this.messageTa = options.messageTa;
    this.details = options.details;
    this.requestId = options.requestId;
    this.timestamp = new Date().toISOString();
    if (options.cause) {
      Object.defineProperty(this, 'cause', { value: options.cause, enumerable: false });
    }
  }

  static validation(message: string, details?: AppErrorDetails, requestId?: string) {
    return new AppError({ code: ErrorCode.VALIDATION_ERROR, message, details, requestId });
  }

  static unauthorized(message = 'Authentication required', requestId?: string) {
    return new AppError({ code: ErrorCode.UNAUTHORIZED, message, requestId });
  }

  static forbidden(message = 'You do not have permission to do that', requestId?: string) {
    return new AppError({ code: ErrorCode.FORBIDDEN, message, requestId });
  }

  static notFound(message = 'Resource not found', requestId?: string) {
    return new AppError({ code: ErrorCode.NOT_FOUND, message, requestId });
  }

  static conflict(message: string, details?: AppErrorDetails, requestId?: string) {
    return new AppError({ code: ErrorCode.CONFLICT, message, details, requestId });
  }

  static internal(message = 'Something went wrong', requestId?: string, cause?: unknown) {
    return new AppError({ code: ErrorCode.INTERNAL_ERROR, message, requestId, cause });
  }

  static serviceUnavailable(message = 'Service unavailable', requestId?: string) {
    return new AppError({ code: ErrorCode.SERVICE_UNAVAILABLE, message, requestId });
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
