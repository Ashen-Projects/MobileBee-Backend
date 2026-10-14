import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../../services/auth/authService';
import * as saleReturnService from '../../services/pos/saleReturn/saleReturnService';

const user = (res: Response) => res.locals.auth as AuthenticatedUser;
const context = (req: Request) => ({ ipAddress: req.ip });

export const lookup = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await saleReturnService.lookupSaleReturn(req.query, user(res)) });
};

export const createExchange = async (req: Request, res: Response): Promise<void> => {
  res.status(201).json({ success: true, data: await saleReturnService.createSaleExchange(req.body, user(res), context(req)) });
};

export const list = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await saleReturnService.listSaleReturns(req.query, user(res)) });
};

export const get = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await saleReturnService.getSaleReturn(req.params.id, user(res)) });
};
