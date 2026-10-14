import { Router } from 'express';
import * as controller from '../../controllers/pos/saleReturnController';
import { requirePermission } from '../../middlewares/permissionMiddleware';
import { asyncHandler } from '../../utils/async-handler';
import { USER_PERMISSIONS } from '../../utils/constants';

export const saleReturnRoutes = Router();

saleReturnRoutes.get('/lookup', requirePermission(USER_PERMISSIONS.SALES_CREATE), asyncHandler(controller.lookup));
saleReturnRoutes.post('/exchange', requirePermission(USER_PERMISSIONS.SALES_CREATE), asyncHandler(controller.createExchange));
saleReturnRoutes.get('/', requirePermission(USER_PERMISSIONS.SALES_VIEW), asyncHandler(controller.list));
saleReturnRoutes.get('/:id', requirePermission(USER_PERMISSIONS.SALES_VIEW), asyncHandler(controller.get));
