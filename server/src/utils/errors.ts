export class AppError extends Error {
  data?: unknown;

  constructor(message: string, data?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.data = data;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class NotFoundError extends AppError {}

export class AuthenticationError extends AppError {}

export class PermissionError extends AppError {}

export class ValidationError extends AppError {}

export class ConflictError extends AppError {}

export class ServerError extends AppError {
  constructor(message = 'An unexpected error occurred', data?: unknown) {
    super(message, data);
  }
}

export const ErrorMessages = {
  RESOURCE_NOT_FOUND: 'The requested resource could not be found.',
  AUTHENTICATION_REQUIRED: 'Authentication is required to access this resource.',
  ACCESS_TOKEN_REQUIRED: 'Invalid credentials: accessToken required for this endpoint.',
  BASIC_AUTH_REQUIRED: 'Basic authentication is required for this endpoint.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  ADMIN_REQUIRED: 'Admin role is required for this action.',
  VALIDATION_FAILED: 'The provided data is invalid.',
  INVALID_UUID_FORMAT: 'Invalid UUID format.',
  CONFLICT: 'The request could not be completed due to a conflict.',
  SERVER_ERROR: 'An unexpected error occurred.',

  invalidUuidFormat: (paramName: string) => `Invalid UUID format for parameter: ${paramName}`,
  invalidBodyField: (field: string, allowedValues: string[]) =>
    `Invalid value for '${field}'. Allowed values: ${allowedValues.join(', ')}`,
  missingPermission: (permission: string) => `Missing required permission: ${permission}`,
} as const;

export const createNotFoundError = (message: string, data?: unknown) =>
  new NotFoundError(message, data);
export const createAuthenticationError = (message: string, data?: unknown) =>
  new AuthenticationError(message, data);
export const createPermissionError = (message: string, data?: unknown) =>
  new PermissionError(message, data);
export const createValidationError = (message: string, data?: unknown) =>
  new ValidationError(message, data);
export const createConflictError = (message: string, data?: unknown) =>
  new ConflictError(message, data);
export const createServerError = (message: string, data?: unknown) =>
  new ServerError(message, data);
