import { Router } from 'express';

import * as controller from '../../../controllers/inventory/stock/stockController';
import * as damageController from '../../../controllers/inventory/stock/stockDamageController';
import { requireAnyPermission, requirePermission, requireRole } from '../../../middlewares/permissionMiddleware';
import { asyncHandler } from '../../../utils/async-handler';
import { USER_PERMISSIONS, USER_ROLES } from '../../../utils/constants';

export const stockRoutes = Router();

stockRoutes.get('/overview', requirePermission(USER_PERMISSIONS.STOCK_VIEW), asyncHandler(controller.getStockOverview));
stockRoutes.get('/statuses', requirePermission(USER_PERMISSIONS.STOCK_VIEW), asyncHandler(controller.listStockStatuses));
stockRoutes.get('/pending-receipts', requirePermission(USER_PERMISSIONS.GRNS_STOCK_ADD), asyncHandler(controller.listPendingStockReceipts));
stockRoutes.get('/availability-check', requirePermission(USER_PERMISSIONS.STOCK_VIEW), asyncHandler(controller.checkStockAvailability));
stockRoutes.get('/damage', requireAnyPermission(USER_PERMISSIONS.STOCK_DAMAGE_VIEW, USER_PERMISSIONS.STOCK_DAMAGE_CREATE), asyncHandler(damageController.listStockDamage));
stockRoutes.post('/damage', requirePermission(USER_PERMISSIONS.STOCK_DAMAGE_CREATE), asyncHandler(damageController.createStockDamage));
stockRoutes.post('/damage/scan', requirePermission(USER_PERMISSIONS.STOCK_DAMAGE_CREATE), asyncHandler(damageController.scanStockForDamage));
stockRoutes.post('/damage/:id/approve', requireRole(USER_ROLES.ADMIN), asyncHandler(damageController.approveStockDamage));
stockRoutes.post('/damage/:id/decline', requireRole(USER_ROLES.ADMIN), asyncHandler(damageController.declineStockDamage));
stockRoutes.get('/products/:productId/units', requirePermission(USER_PERMISSIONS.STOCK_VIEW), asyncHandler(controller.listStockUnits));
stockRoutes.get('/', requirePermission(USER_PERMISSIONS.STOCK_VIEW), asyncHandler(controller.listStock));
