import type { Request, Response } from 'express';

import type { AuthenticatedUser } from '../../services/auth/authService';
import {
  createUser as createUserService,
  getOwnProfile as getOwnProfileService,
  listUsers as listUsersService,
  regenerateUserCredentials as regenerateUserCredentialsService,
  updateUser as updateUserService,
  updateUserStatus as updateUserStatusService,
  updateUserLocation as updateUserLocationService,
  updateOwnProfile as updateOwnProfileService,
} from '../../services/user/userService';

const requestContext = (req: Request) => ({ ipAddress: req.ip });

export const listUsers = async (req: Request, res: Response): Promise<void> => {
  const result = await listUsersService(req.query);
  res.status(200).json({ success: true, data: result });
};

export const getOwnProfile = async (_req: Request, res: Response): Promise<void> => {
  const result = await getOwnProfileService(res.locals.auth as AuthenticatedUser);
  res.status(200).json({ success: true, data: result });
};

export const updateOwnProfile = async (req: Request, res: Response): Promise<void> => {
  const result = await updateOwnProfileService(
    req.body,
    res.locals.auth as AuthenticatedUser,
    requestContext(req),
  );
  res.status(200).json({ success: true, data: result });
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  const result = await createUserService(
    req.body,
    res.locals.auth as AuthenticatedUser,
    requestContext(req),
  );
  res.status(201).json({ success: true, data: result });
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const result = await updateUserService(
    req.params.id,
    req.body,
    res.locals.auth as AuthenticatedUser,
    requestContext(req),
  );
  res.status(200).json({ success: true, data: result });
};

export const updateUserStatus = async (req: Request, res: Response): Promise<void> => {
  const result = await updateUserStatusService(
    req.params.id,
    req.body,
    res.locals.auth as AuthenticatedUser,
    requestContext(req),
  );
  res.status(200).json({ success: true, data: result });
};
export const updateUserLocation = async (req: Request, res: Response): Promise<void> => {
  const result = await updateUserLocationService(
    req.params.id,
    req.body,
    res.locals.auth as AuthenticatedUser,
    requestContext(req),
  );
  res.status(200).json({ success: true, data: result });
};

export const regenerateUserCredentials = async (req: Request, res: Response): Promise<void> => {
  const result = await regenerateUserCredentialsService(
    req.params.id,
    res.locals.auth as AuthenticatedUser,
    requestContext(req),
  );
  res.status(200).json({ success: true, data: result });
};
