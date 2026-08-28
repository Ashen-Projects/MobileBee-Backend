import type { RequestHandler } from 'express';

import { AUTH_SESSION_COOKIE_NAME } from '../config/auth';
import { AppError } from '../errors/app-error';
import { getAuthenticatedUser } from '../services/auth/authService';
import { firebaseAuth } from '../services/auth/firebaseService';
import { asyncHandler } from '../utils/async-handler';
import { readCookie } from '../utils/cookies';

export const requireAuth: RequestHandler = asyncHandler(async (req, res, next) => {
  const authorization = req.header('authorization');
  const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : undefined;
  const sessionCookie = readCookie(req.header('cookie'), AUTH_SESSION_COOKIE_NAME);

  if (!sessionCookie && !bearerToken) throw new AppError('Authentication is required.', 401);

  try {
    const decodedToken = sessionCookie
      ? await firebaseAuth.verifySessionCookie(sessionCookie, true)
      : await firebaseAuth.verifyIdToken(bearerToken as string, true);
    res.locals.auth = await getAuthenticatedUser(decodedToken.uid);
    res.locals.firebaseToken = decodedToken;
    next();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('The authentication token is invalid, expired, or revoked.', 401);
  }
});
