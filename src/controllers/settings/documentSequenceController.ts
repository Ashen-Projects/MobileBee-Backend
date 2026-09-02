import type { Request, Response } from 'express';

import type { AuthenticatedUser } from '../../services/auth/authService';
import * as service from '../../services/settings/documentSequenceService';

const context = (req: Request) => ({ ipAddress: req.ip });
const user = (res: Response) => res.locals.auth as AuthenticatedUser;

export const listDocumentSequences = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.listDocumentSequences(req.query) });
};
export const getDocumentSequence = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.getDocumentSequence(req.params.id) });
};
export const createDocumentSequence = async (req: Request, res: Response): Promise<void> => {
  res.status(201).json({ success: true, data: await service.createDocumentSequence(req.body, user(res), context(req)) });
};
export const updateDocumentSequence = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await service.updateDocumentSequence(req.params.id, req.body, user(res), context(req)) });
};
