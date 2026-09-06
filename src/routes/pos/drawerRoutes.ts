import { Router } from 'express';

import * as controller from '../../controllers/pos/drawerController';
import { requirePermission } from '../../middlewares/permissionMiddleware';
import { asyncHandler } from '../../utils/async-handler';
import { USER_PERMISSIONS } from '../../utils/constants';

export const drawerRoutes = Router();

drawerRoutes.get('/current', requirePermission(USER_PERMISSIONS.SALES_CREATE), asyncHandler(controller.current));
drawerRoutes.post('/open', requirePermission(USER_PERMISSIONS.SALES_CREATE), asyncHandler(controller.open));
drawerRoutes.post('/close', requirePermission(USER_PERMISSIONS.SALES_CREATE), asyncHandler(controller.close));
