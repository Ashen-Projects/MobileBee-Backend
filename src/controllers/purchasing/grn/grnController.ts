import type { Request, Response } from 'express';

import type { AuthenticatedUser } from '../../../services/auth/authService';
import * as service from '../../../services/purchasing/grn/grnService';

const context = (req: Request) => ({ ipAddress: req.ip });
const user = (res: Response) => res.locals.auth as AuthenticatedUser;

export const listGrns = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.listGrns(req.query) });
};

export const getGrn = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.getGrn(req.params.id) });
};

export const createGrn = async (req: Request, res: Response): Promise<void> => {
  res.status(201).json({ success: true, data: await service.createGrn(req.body, user(res), context(req)) });
};

export const verifyGrnCount = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.verifyGrnCount(req.params.id, req.body, user(res), context(req)) });
};

export const decideGrnFinance = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.decideGrnFinance(req.params.id, req.body, user(res), context(req)) });
};

export const addGrnStock = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.addGrnStock(req.params.id, req.body, user(res), context(req)) });
};

export const addGrnDocuments = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.addGrnDocuments(req.params.id, req.body, user(res), context(req)) });
};

export const addGrnNote = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.addGrnNote(req.params.id, req.body, user(res), context(req)) });
};
