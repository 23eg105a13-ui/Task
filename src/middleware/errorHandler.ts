import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../models/types';
import { config } from '../config/env';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found.`,
  });
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const isApiError = err instanceof ApiError;
  const statusCode = isApiError ? err.statusCode : 500;

  if (!isApiError) {
    console.error('Unhandled error:', err);
  }

  res.status(statusCode).json({
    success: false,
    error: isApiError ? err.message : 'Internal server error.',
    ...(config.nodeEnv === 'development' && !isApiError ? { stack: err.stack } : {}),
  });
}
