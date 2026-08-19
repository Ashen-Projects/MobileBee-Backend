import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import { AppError } from '../errors/app-error';
import { env } from '../env';
import { logger } from '../logger/logger';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation error.',
      errors: error.issues,
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
    return;
  }

  logger.error('Unhandled request error.', {
    error: error instanceof Error ? error.message : String(error),
  });

  const message =
    env.NODE_ENV === 'production' ? 'Internal server error.' : error.message ?? 'Internal server error.';

  res.status(500).json({
    success: false,
    message,
  });
};
