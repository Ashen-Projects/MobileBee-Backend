import type { Request, Response } from 'express';

import { getAuthenticatedUser, recordSuccessfulLogin, type AuthenticatedUser } from '../../services/auth/authService';
import { loginSchema } from '../../services/auth/authValidation';
import { firebaseAuth, signInWithPassword } from '../../services/auth/firebaseService';

export const login = async (req: Request, res: Response): Promise<void> => {
  const credentials = loginSchema.parse(req.body);
  const firebaseSession = await signInWithPassword(credentials.email, credentials.password);
  const user = await getAuthenticatedUser(firebaseSession.localId);
  await recordSuccessfulLogin(firebaseSession.localId);

  res.status(200).json({
    success: true,
    data: {
      expiresIn: Number(firebaseSession.expiresIn),
      idToken: firebaseSession.idToken,
      refreshToken: firebaseSession.refreshToken,
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
  res.status(204).send();
};
