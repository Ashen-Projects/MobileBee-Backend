import type { Request, Response } from 'express';

import type { AuthenticatedUser } from '../../../services/auth/authService';
import * as service from '../../../services/purchasing/purchaseOrder/purchaseOrderService';

const context = (req: Request) => ({ ipAddress: req.ip });
const user = (res: Response) => res.locals.auth as AuthenticatedUser;

export const listPurchaseOrderStatuses = async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.listPurchaseOrderStatuses() });
};
export const listPurchaseOrders = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.listPurchaseOrders(req.query) });
};
export const getPurchaseOrder = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.getPurchaseOrder(req.params.id) });
};
export const createPurchaseOrder = async (req: Request, res: Response): Promise<void> => {
  res.status(201).json({ success: true, data: await service.createPurchaseOrder(req.body, user(res), context(req)) });
};
export const updatePurchaseOrder = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.updatePurchaseOrder(req.params.id, req.body, user(res), context(req)) });
};
export const submitPurchaseOrder = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.submitPurchaseOrder(req.params.id, req.body, user(res), context(req)) });
};
export const approvePurchaseOrder = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.approvePurchaseOrder(req.params.id, req.body, user(res), context(req)) });
};
export const rejectPurchaseOrder = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.rejectPurchaseOrder(req.params.id, req.body, user(res), context(req)) });
};
export const markPurchaseOrderOrdered = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.markPurchaseOrderOrdered(req.params.id, req.body, user(res), context(req)) });
};
export const cancelPurchaseOrder = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.cancelPurchaseOrder(req.params.id, req.body, user(res), context(req)) });
};

