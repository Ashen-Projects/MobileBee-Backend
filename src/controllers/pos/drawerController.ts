import type { Request, Response } from 'express';

import type { AuthenticatedUser } from '../../services/auth/authService';
import * as drawerService from '../../services/pos/drawer/drawerService';

const user = (res: Response) => res.locals.auth as AuthenticatedUser;
const context = (req: Request) => ({ ipAddress: req.ip });

export const current = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: { drawer: await drawerService.getCurrentDrawer(user(res)) } });
};

export const open = async (req: Request, res: Response): Promise<void> => {
  res.status(201).json({ success: true, data: await drawerService.openDrawer(req.body, user(res), context(req)) });
};

export const close = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await drawerService.closeDrawer(req.body, user(res), context(req)) });
};
