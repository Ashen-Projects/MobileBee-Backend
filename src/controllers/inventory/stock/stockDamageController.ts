import type { Request, Response } from 'express';

import type { AuthenticatedUser } from '../../../services/auth/authService';
import * as service from '../../../services/inventory/stock/stockDamageService';

const context = (req: Request) => ({ ipAddress: req.ip });
const user = (res: Response) => res.locals.auth as AuthenticatedUser;

export const createStockDamage = async (req: Request, res: Response): Promise<void> => {
  res.status(201).json({ success: true, data: await service.createStockDamage(req.body, user(res), context(req)) });
};

export const approveStockDamage = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.approveStockDamage(req.params.id, user(res), context(req)) });
};

export const declineStockDamage = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.declineStockDamage(req.params.id, req.body, user(res), context(req)) });
};

export const listStockDamage = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.listStockDamage(req.query, user(res)) });
};

export const scanStockForDamage = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.scanStockForDamage(req.body, user(res)) });
};
