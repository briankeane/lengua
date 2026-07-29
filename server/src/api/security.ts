import { NextFunction, Request, Response } from 'express';
import { expressjwt } from 'express-jwt';
import config from '../config/config';
import { AuthenticationError, ErrorMessages, PermissionError } from '../utils/errors';

if (!config.JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}

const jwt = expressjwt({
  secret: config.JWT_SECRET,
  algorithms: ['HS256'],
  requestProperty: 'auth',
});

export interface AuthenticatedRequest extends Request {
  auth: {
    id: string;
    firstName: string;
    lastName?: string;
    displayName?: string;
    email: string;
    profileImageUrl?: string;
    role: 'admin' | 'user' | 'guest';
    [key: string]: string | number | undefined;
  };
}

export const ROLE_HIERARCHY = {
  guest: 0,
  user: 1,
  admin: 2,
} as const;

type UserRole = keyof typeof ROLE_HIERARCHY;

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = (req.headers.authorization || req.headers.Authorization) as string;

  const basicTokens = config.BASIC_AUTH_TOKENS?.split(' ');
  if (basicTokens && authHeader) {
    for (const token of basicTokens) {
      if (authHeader === `Basic ${token}`) {
        return next();
      }
    }
  }

  authenticateAccessToken(req, res, next);
}

export function authenticateAccessToken(req: Request, res: Response, next: NextFunction) {
  jwt(req, res, (err) => {
    if (err) {
      return next(new AuthenticationError(ErrorMessages.ACCESS_TOKEN_REQUIRED));
    }

    const authReq = req as AuthenticatedRequest;
    if (!authReq.auth) {
      return next(new AuthenticationError('No auth data in token'));
    }

    Object.keys(req.params).forEach((paramName) => {
      if (req.params[paramName] === 'me') {
        req.params[paramName] = authReq.auth.id;
      }
    });

    return next();
  });
}

export function requireRoleOfAtLeast(minimumRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userRole = authReq.auth?.role as UserRole;

      if (!userRole || !(userRole in ROLE_HIERARCHY)) {
        next(new PermissionError('Invalid user role'));
        return;
      }

      const userRoleLevel = ROLE_HIERARCHY[userRole];
      const minimumRoleLevel = ROLE_HIERARCHY[minimumRole];

      if (userRoleLevel < minimumRoleLevel) {
        next(new PermissionError(ErrorMessages.ADMIN_REQUIRED));
        return;
      }

      return next();
    } catch (error) {
      next(error);
    }
  };
}

export function isOperatingOnSelf(paramName: string, source: 'params' | 'body' = 'params') {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    const targetUserId = source === 'params' ? req.params[paramName] : req.body[paramName];
    const authenticatedUserId = authReq.auth?.id;

    if (targetUserId !== authenticatedUserId) {
      next(new PermissionError('You can only perform this action on your own account'));
      return;
    }

    next();
  };
}
