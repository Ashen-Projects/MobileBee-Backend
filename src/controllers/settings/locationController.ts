import type { Request, Response } from 'express';

import type { AuthenticatedUser } from '../../services/auth/authService';
import * as service from '../../services/settings/locationService';

const context = (req: Request) => ({ ipAddress: req.ip });
const user = (res: Response) => res.locals.auth as AuthenticatedUser;

export const listLocations = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.listLocations(req.query) });
};
export const getLocation = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.getLocation(req.params.id) });
};
export const createLocation = async (req: Request, res: Response): Promise<void> => {
  res.status(201).json({ success: true, data: await service.createLocation(req.body, user(res), context(req)) });
};
export const updateLocation = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.updateLocation(req.params.id, req.body, user(res), context(req)) });
};
export const setLocationStatus = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.setLocationStatus(req.params.id, req.body, user(res), context(req)) });
};
