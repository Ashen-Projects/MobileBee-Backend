import { Router } from 'express';

import * as controller from '../../controllers/reports/reportController';
import { requirePermission } from '../../middlewares/permissionMiddleware';
import { asyncHandler } from '../../utils/async-handler';
import { USER_PERMISSIONS } from '../../utils/constants';

export const reportRoutes = Router();

reportRoutes.get('/sales', requirePermission(USER_PERMISSIONS.SALES_VIEW), asyncHandler(controller.salesReport));
reportRoutes.get('/inventory', requirePermission(USER_PERMISSIONS.STOCK_VIEW), asyncHandler(controller.inventoryReport));
reportRoutes.get('/purchasing', requirePermission(USER_PERMISSIONS.GRNS_VIEW), asyncHandler(controller.purchasingReport));
reportRoutes.get('/repairs', requirePermission(USER_PERMISSIONS.REPAIRS_VIEW), asyncHandler(controller.repairsReport));
