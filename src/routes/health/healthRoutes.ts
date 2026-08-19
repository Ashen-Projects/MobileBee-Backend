import { Router } from 'express';

import { getHealth } from '../../controllers/health/healthController';

export const healthRoutes = Router();

healthRoutes.get('/', getHealth);
