import type { RequestHandler } from 'express';

import { AppError } from '../errors/app-error';
import type { AuthenticatedUser } from '../services/auth/authService';

export const requirePermission = (...requiredPermissions: string[]): RequestHandler =>
  (_req, res, next) => {
    const user = res.locals.auth as AuthenticatedUser | undefined;
    if (!user) return next(new AppError('Authentication is required.', 401));

    const isAdministrator = user.roles.some(({ name }) => name === 'admin');
    const isAllowed = requiredPermissions.every((permission) => user.permissions.includes(permission));

    if (!isAdministrator && !isAllowed) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }

    next();
  };

export const requireRole = (...requiredRoles: string[]): RequestHandler =>
  (_req, res, next) => {
    const user = res.locals.auth as AuthenticatedUser | undefined;
    if (!user) return next(new AppError('Authentication is required.', 401));

    const isAllowed = requiredRoles.some((requiredRole) =>
      user.roles.some(({ name }) => name === requiredRole),
    );

    if (!isAllowed) return next(new AppError('This action is restricted to an administrator.', 403));
    next();
  };
