import type { Request, Response } from 'express';

import type { AuthenticatedUser } from '../../services/auth/authService';
import { getOverview } from '../../services/dashboard/dashboardService';

export const overview = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    data: await getOverview(req.query, res.locals.auth as AuthenticatedUser),
  });
};
