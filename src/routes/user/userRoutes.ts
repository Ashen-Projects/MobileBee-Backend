import { Router } from 'express';

import { requireRole } from '../../middlewares/permissionMiddleware';
import { asyncHandler } from '../../utils/async-handler';
import { createUser } from '../../controllers/user/userController';

export const userRoutes = Router();

userRoutes.post('/', requireRole('admin'), asyncHandler(createUser));
