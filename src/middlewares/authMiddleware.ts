import type { RequestHandler } from 'express';

import { AppError } from '../errors/app-error';
import { getAuthenticatedUser } from '../services/auth/authService';
import { firebaseAuth } from '../services/auth/firebaseService';
import { asyncHandler } from '../utils/async-handler';

export const requireAuth: RequestHandler = asyncHandler(async (req, res, next) => {
  const authorization = req.header('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    throw new AppError('A valid Bearer token is required.', 401);
  }

  const token = authorization.slice(7).trim();
  if (!token) throw new AppError('A valid Bearer token is required.', 401);

  try {
    const decodedToken = await firebaseAuth.verifyIdToken(token, true);
    res.locals.auth = await getAuthenticatedUser(decodedToken.uid);
    res.locals.firebaseToken = decodedToken;
    next();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('The authentication token is invalid, expired, or revoked.', 401);
  }
});
