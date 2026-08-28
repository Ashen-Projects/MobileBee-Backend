import type { Request, Response } from 'express';

import { AUTH_SESSION_COOKIE_NAME, AUTH_SESSION_MAX_AGE_MS } from '../../config/auth';
import { env } from '../../env';
import { getAuthenticatedUser, recordSuccessfulLogin, type AuthenticatedUser } from '../../services/auth/authService';
import { loginSchema } from '../../services/auth/authValidation';
import { firebaseAuth, signInWithPassword } from '../../services/auth/firebaseService';

export const login = async (req: Request, res: Response): Promise<void> => {
  const credentials = loginSchema.parse(req.body);
  const firebaseSession = await signInWithPassword(credentials.email, credentials.password);
  const user = await getAuthenticatedUser(firebaseSession.localId);
  await recordSuccessfulLogin(firebaseSession.localId);
  const sessionCookie = await firebaseAuth.createSessionCookie(firebaseSession.idToken, {
    expiresIn: AUTH_SESSION_MAX_AGE_MS,
  });

  res.cookie(AUTH_SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    maxAge: AUTH_SESSION_MAX_AGE_MS,
    path: '/',
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
  });

  res.status(200).json({
    success: true,
    data: {
      user,
    },
  });
};

export const me = async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: res.locals.auth as AuthenticatedUser });
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  const user = res.locals.auth as AuthenticatedUser;
  await firebaseAuth.revokeRefreshTokens(user.firebaseUid);
  res.clearCookie(AUTH_SESSION_COOKIE_NAME, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
  });
  res.status(204).send();
};
