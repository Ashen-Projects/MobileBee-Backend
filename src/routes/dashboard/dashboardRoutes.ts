import { Router } from 'express';

import { overview } from '../../controllers/dashboard/dashboardController';
import { requirePermission } from '../../middlewares/permissionMiddleware';
import { asyncHandler } from '../../utils/async-handler';
import { USER_PERMISSIONS } from '../../utils/constants';

export const dashboardRoutes = Router();

dashboardRoutes.get('/overview', requirePermission(USER_PERMISSIONS.DASHBOARD_VIEW), asyncHandler(overview));
