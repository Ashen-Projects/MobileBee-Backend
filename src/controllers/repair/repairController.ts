import type { Request, Response } from 'express';

import type { AuthenticatedUser } from '../../services/auth/authService';
import * as repairService from '../../services/repair/repairService';

const user = (res: Response) => res.locals.auth as AuthenticatedUser;
const context = (req: Request) => ({ ipAddress: req.ip });

export const listRepairJobs = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await repairService.listRepairJobs(req.query) });
};

export const getRepairJob = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await repairService.getRepairJob(req.params.id) });
};

export const createRepairJob = async (req: Request, res: Response): Promise<void> => {
  res.status(201).json({ success: true, data: await repairService.createRepairJob(req.body, user(res), context(req)) });
};

export const updateRepairStatus = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await repairService.updateRepairStatus(req.params.id, req.body, user(res), context(req)) });
};

export const publicRepairStatus = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await repairService.publicRepairStatus(req.query) });
};
