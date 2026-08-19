import type { Request, Response } from 'express';

import type { AuthenticatedUser } from '../../services/auth/authService';
import { createUser as createUserService } from '../../services/user/userService';

export const createUser = async (req: Request, res: Response): Promise<void> => {
  const result = await createUserService(req.body, res.locals.auth as AuthenticatedUser);
  res.status(201).json({ success: true, data: result });
};
