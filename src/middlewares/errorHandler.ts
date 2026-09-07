import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import { AppError } from '../errors/app-error';
import { env } from '../env';
import { logger } from '../logger/logger';

type ErrorCause = {
  code?: unknown;
  errno?: unknown;
  message?: unknown;
  sqlState?: unknown;
};

const getErrorLogContext = (error: unknown) => {
  if (!(error instanceof Error)) {
    return { error: String(error) };
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  const databaseCause =
    cause && typeof cause === 'object' ? (cause as ErrorCause) : undefined;

  return {
    error: error.message,
    ...(databaseCause?.message
      ? { cause: String(databaseCause.message) }
      : {}),
    ...(databaseCause?.code ? { code: String(databaseCause.code) } : {}),
    ...(databaseCause?.errno !== undefined
      ? { errno: databaseCause.errno }
      : {}),
    ...(databaseCause?.sqlState
      ? { sqlState: String(databaseCause.sqlState) }
      : {}),
  };
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: error.issues[0]?.message ?? 'Validation error.',
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

  logger.error('Unhandled request error.', getErrorLogContext(error));

  const message =
    env.NODE_ENV === 'production'
      ? 'Internal server error.'
      : error instanceof Error
        ? error.message
        : 'Internal server error.';

  res.status(500).json({
    success: false,
    message,
  });
};
