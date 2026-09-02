import type { Request, Response } from 'express';

import type { AuthenticatedUser } from '../../services/auth/authService';
import * as saleService from '../../services/pos/sale/saleService';

const user = (res: Response) => res.locals.auth as AuthenticatedUser;
const context = (req: Request) => ({ ipAddress: req.ip });

export const listSales = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await saleService.listSales(req.query) });
};

export const getSale = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await saleService.getSale(req.params.id) });
};

export const createSale = async (req: Request, res: Response): Promise<void> => {
  res.status(201).json({ success: true, data: await saleService.createSale(req.body, user(res), context(req)) });
};

export const searchProducts = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await saleService.searchProducts(req.query, user(res)) });
};

export const searchCustomers = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await saleService.searchCustomers(req.query) });
};
