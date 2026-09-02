import { Router } from 'express';

import * as controller from '../../../controllers/inventory/stock/stockController';
import { requirePermission } from '../../../middlewares/permissionMiddleware';
import { asyncHandler } from '../../../utils/async-handler';
import { USER_PERMISSIONS } from '../../../utils/constants';

export const stockRoutes = Router();

stockRoutes.get('/overview', requirePermission(USER_PERMISSIONS.STOCK_VIEW), asyncHandler(controller.getStockOverview));
stockRoutes.get('/statuses', requirePermission(USER_PERMISSIONS.STOCK_VIEW), asyncHandler(controller.listStockStatuses));
stockRoutes.get('/pending-receipts', requirePermission(USER_PERMISSIONS.GRNS_STOCK_ADD), asyncHandler(controller.listPendingStockReceipts));
stockRoutes.get('/availability-check', requirePermission(USER_PERMISSIONS.STOCK_VIEW), asyncHandler(controller.checkStockAvailability));
stockRoutes.get('/products/:productId/units', requirePermission(USER_PERMISSIONS.STOCK_VIEW), asyncHandler(controller.listStockUnits));
stockRoutes.get('/', requirePermission(USER_PERMISSIONS.STOCK_VIEW), asyncHandler(controller.listStock));
