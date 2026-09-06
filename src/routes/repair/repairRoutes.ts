import { Router } from 'express';

import * as controller from '../../controllers/repair/repairController';
import { requirePermission } from '../../middlewares/permissionMiddleware';
import { asyncHandler } from '../../utils/async-handler';
import { USER_PERMISSIONS } from '../../utils/constants';

export const repairRoutes = Router();
export const publicRepairStatusRoutes = Router();

publicRepairStatusRoutes.get('/', asyncHandler(controller.publicRepairStatus));

repairRoutes.get('/', requirePermission(USER_PERMISSIONS.REPAIRS_VIEW), asyncHandler(controller.listRepairJobs));
repairRoutes.post('/', requirePermission(USER_PERMISSIONS.REPAIRS_CREATE), asyncHandler(controller.createRepairJob));
repairRoutes.get('/:id', requirePermission(USER_PERMISSIONS.REPAIRS_VIEW), asyncHandler(controller.getRepairJob));
repairRoutes.patch('/:id/status', requirePermission(USER_PERMISSIONS.REPAIRS_UPDATE), asyncHandler(controller.updateRepairStatus));
