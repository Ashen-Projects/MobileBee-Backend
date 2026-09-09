import type { Request, Response } from 'express';

import type { AuthenticatedUser } from '../../services/auth/authService';
import * as reportService from '../../services/reports/reportService';

const user = (res: Response) => res.locals.auth as AuthenticatedUser;

export const salesReport = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await reportService.salesReport(req.query, user(res)) });
};

export const inventoryReport = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await reportService.inventoryReport(req.query, user(res)) });
};

export const purchasingReport = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await reportService.purchasingReport(req.query, user(res)) });
};

export const repairsReport = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await reportService.repairsReport(req.query, user(res)) });
};
