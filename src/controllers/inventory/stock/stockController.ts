import type { Request, Response } from 'express';

import * as service from '../../../services/inventory/stock/stockService';

export const getStockOverview = async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.getStockOverview() });
};

export const listStock = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.listStock(req.query) });
};

export const listPendingStockReceipts = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.listPendingStockReceipts(req.query) });
};

export const listStockStatuses = async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.listStockStatuses() });
};
