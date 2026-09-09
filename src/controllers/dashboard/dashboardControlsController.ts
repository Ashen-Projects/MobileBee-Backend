import type { Request, Response } from 'express';

import type { AuthenticatedUser } from '../../services/auth/authService';
import * as service from '../../services/dashboard/dashboardControlsService';

const context = (req: Request) => ({ ipAddress: req.ip });
const user = (res: Response) => res.locals.auth as AuthenticatedUser;

export const getControls = async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.getDashboardControls(user(res)) });
};

export const saveTarget = async (req: Request, res: Response): Promise<void> => {
  const id = await service.saveDashboardTarget(req.body, user(res), context(req));
  res.status(201).json({ success: true, data: { id } });
};

export const saveSettings = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.saveDashboardInsightSettings(req.body, user(res), context(req)) });
};

export const saveInsightAction = async (req: Request, res: Response): Promise<void> => {
  await service.saveDashboardInsightAction(req.params.insightId, req.body, user(res), context(req));
  res.status(200).json({ success: true, data: { success: true } });
};
