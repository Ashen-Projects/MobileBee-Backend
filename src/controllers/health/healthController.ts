import type { Request, Response } from 'express';

import { getHealthStatus } from '../../services/health/healthService';

export const getHealth = async (_req: Request, res: Response): Promise<void> => {
  const healthStatus = await getHealthStatus();

  res.status(200).json({
    success: true,
    message: 'Mobile Shop POS API is healthy.',
    data: healthStatus,
  });
};
