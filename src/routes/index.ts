import { Router } from 'express';

import { healthRoutes } from './health/healthRoutes';
import { authRoutes } from './auth/authRoutes';
import { userRoutes } from './user/userRoutes';
import { requireAuth } from '../middlewares/authMiddleware';

export const apiRoutes = Router();

apiRoutes.use('/health', healthRoutes);
apiRoutes.use('/auth', authRoutes);

// All API modules registered below this line are authenticated by default.
apiRoutes.use(requireAuth);
apiRoutes.use('/users', userRoutes);
