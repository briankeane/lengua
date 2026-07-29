import { NextFunction, Request, Response } from 'express';
import logger from '../logger';
import {
  AppError,
  AuthenticationError,
  ConflictError,
  NotFoundError,
  PermissionError,
  ServerError,
  ValidationError,
} from '../utils/errors';

function isSequelizeValidationError(error: Error): boolean {
  return (
    error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError'
  );
}

type ErrorWithData = Error & { data?: unknown };

type ValidationErrorItem = { field: string; message: string };

type SequelizeValidationError = Error & {
  errors: Array<{ path: string; message: string }>;
};

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): Response | void {
  if (res.headersSent) {
    return next(err as Error);
  }

  const error = err instanceof Error ? (err as ErrorWithData) : new Error(String(err));

  let statusCode = 500;

  if (error instanceof NotFoundError) {
    statusCode = 404;
  } else if (error instanceof AuthenticationError) {
    statusCode = 401;
  } else if (error instanceof PermissionError) {
    statusCode = 403;
  } else if (error instanceof ValidationError) {
    statusCode = 400;
  } else if (error instanceof ConflictError) {
    statusCode = 409;
  } else if (error instanceof ServerError) {
    statusCode = 500;
  } else if (error instanceof AppError) {
    statusCode = 400;
  }

  if (isSequelizeValidationError(error)) {
    statusCode = 400;
    const validationError = error as SequelizeValidationError;
    const validationErrors: ValidationErrorItem[] = validationError.errors.map((item) => ({
      field: item.path,
      message: item.message,
    }));

    logger.error('Validation Error', {
      errors: validationErrors,
      path: req.path,
      method: req.method,
      userId: (req as { user?: { id?: string } }).user?.id,
    });

    return res.status(statusCode).json({
      error: {
        message: 'Validation error',
        data: validationErrors,
      },
    });
  }

  if (error instanceof AppError) {
    logger.error(`${error.name || 'Error'}: ${error.message}`, {
      statusCode,
      stack: error.stack,
      data: error.data,
      path: req.path,
      method: req.method,
      userId: (req as { user?: { id?: string } }).user?.id,
    });
  } else {
    logger.error('Unhandled Server Error', {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      userId: (req as { user?: { id?: string } }).user?.id,
    });
  }

  const errorResponse: { error: { message: string; data?: unknown } } = {
    error: {
      message: error.message || 'An unexpected error occurred',
    },
  };

  if (error instanceof AppError && error.data) {
    errorResponse.error.data = error.data;
  }

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && statusCode >= 500) {
    errorResponse.error.message = 'Internal Server Error';
  }

  return res.status(statusCode).json(errorResponse);
}
