import type { RequestHandler } from 'express';

/** 404 for unmatched routes, in the same envelope as every other error. */
export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    },
  });
};
