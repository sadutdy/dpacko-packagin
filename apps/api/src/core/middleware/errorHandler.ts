import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { isDomainError } from '@ameen/domain';

import { logger } from '../../config/logger.js';
import { AppError, isAppError } from '../errors/AppError.js';
import { ErrorCode } from '../errors/ErrorCode.js';
import { toProblem } from '../errors/problem.js';
import { getRequestId } from '../context/requestContext.js';

function mapDomainCode(code: string): ErrorCode {
  switch (code) {
    case 'INVALID_TRANSITION':
      return ErrorCode.INVALID_TRANSITION;
    case 'INSUFFICIENT_STOCK':
      return ErrorCode.INSUFFICIENT_STOCK;
    case 'CREDIT_LIMIT_EXCEEDED':
      return ErrorCode.CREDIT_LIMIT_EXCEEDED;
    case 'NOT_DELEGATED':
      return ErrorCode.FORBIDDEN;
    case 'LIMIT_EXCEEDED':
      return ErrorCode.CONFLICT;
    case 'VALIDATION_ERROR':
      return ErrorCode.VALIDATION_ERROR;
    default:
      return ErrorCode.INTERNAL_ERROR;
  }
}

/** The one error boundary: maps anything thrown onto the problem+json envelope. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = req.requestId ?? getRequestId();

  let appError: AppError;

  if (isAppError(err)) {
    appError = err;
  } else if (isDomainError(err)) {
    appError = new AppError({
      code: mapDomainCode(err.code),
      message: err.message,
      details: err.details,
      requestId,
    });
  } else if (err instanceof ZodError) {
    appError = AppError.validation(
      'Request validation failed',
      {
        issues: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      },
      requestId,
    );
  } else if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: number }).code === 11000
  ) {
    appError = AppError.conflict('A record with these values already exists', undefined, requestId);
  } else {
    logger.error({ err, requestId }, 'Unhandled error');
    appError = AppError.internal('Something went wrong', requestId, err);
  }

  if (appError.status >= 500) {
    logger.error({ err, requestId, code: appError.code }, 'Request failed');
  }

  res.status(appError.status).json(toProblem(appError));
};
