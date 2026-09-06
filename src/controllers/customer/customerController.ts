import type { Request, Response } from 'express';

import type { AuthenticatedUser } from '../../services/auth/authService';
import * as customerService from '../../services/customer/customerService';

const user = (res: Response) => res.locals.auth as AuthenticatedUser;
const context = (req: Request) => ({ ipAddress: req.ip });

export const listCustomers = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await customerService.listCustomers(req.query) });
};

export const getCustomer = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await customerService.getCustomer(req.params.id) });
};

export const createCustomer = async (req: Request, res: Response): Promise<void> => {
  res.status(201).json({ success: true, data: await customerService.createCustomer(req.body, user(res), context(req)) });
};

export const updateCustomer = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await customerService.updateCustomer(req.params.id, req.body, user(res), context(req)) });
};

export const updateCustomerStatus = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await customerService.updateCustomerStatus(req.params.id, req.body, user(res), context(req)) });
};
