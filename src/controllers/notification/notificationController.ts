import type { Request, Response } from 'express';

import type { AuthenticatedUser } from '../../services/auth/authService';
import * as service from '../../services/notification/notificationService';

const user = (res: Response) => res.locals.auth as AuthenticatedUser;

export const list = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.listNotifications(req.query, user(res)) });
};

export const unreadCount = async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: { count: await service.getUnreadCount(user(res)) } });
};

export const read = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.markNotificationRead(req.params.id, user(res)) });
};

export const readAll = async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.markAllRead(user(res)) });
};
