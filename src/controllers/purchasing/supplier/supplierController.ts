import type { Request, Response } from 'express';

import type { AuthenticatedUser } from '../../../services/auth/authService';
import * as supplierService from '../../../services/purchasing/supplier/supplierService';

const context = (req: Request) => ({ ipAddress: req.ip });
const user = (res: Response) => res.locals.auth as AuthenticatedUser;

export const listSuppliers = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await supplierService.listSuppliers(req.query) });
};
export const getSupplier = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await supplierService.getSupplier(req.params.id) });
};
export const createSupplier = async (req: Request, res: Response): Promise<void> => {
  res.status(201).json({ success: true, data: await supplierService.createSupplier(req.body, user(res), context(req)) });
};
export const reserveSupplierCode = async (_req: Request, res: Response): Promise<void> => {
  res.status(201).json({ success: true, data: await supplierService.reserveSupplierCode() });
};
export const updateSupplier = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await supplierService.updateSupplier(req.params.id, req.body, user(res), context(req)) });
};
export const setSupplierStatus = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await supplierService.setSupplierStatus(req.params.id, req.body, user(res), context(req)) });
};
export const upsertSupplierProduct = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await supplierService.upsertSupplierProduct(req.params.id, req.params.productId, req.body, user(res), context(req)) });
};
export const setSupplierProductStatus = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await supplierService.setSupplierProductStatus(req.params.id, req.params.productId, req.body, user(res), context(req)) });
};
