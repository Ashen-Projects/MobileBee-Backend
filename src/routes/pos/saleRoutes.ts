import { Router } from 'express';

import * as controller from '../../controllers/pos/saleController';
import { requirePermission } from '../../middlewares/permissionMiddleware';
import { asyncHandler } from '../../utils/async-handler';
import { USER_PERMISSIONS } from '../../utils/constants';

export const saleRoutes = Router();

saleRoutes.get('/products/search', requirePermission(USER_PERMISSIONS.SALES_CREATE), asyncHandler(controller.searchProducts));
saleRoutes.get('/customers/search', requirePermission(USER_PERMISSIONS.SALES_CREATE), asyncHandler(controller.searchCustomers));
saleRoutes.post('/', requirePermission(USER_PERMISSIONS.SALES_CREATE), asyncHandler(controller.createSale));
saleRoutes.get('/', requirePermission(USER_PERMISSIONS.SALES_VIEW), asyncHandler(controller.listSales));
saleRoutes.get('/:id', requirePermission(USER_PERMISSIONS.SALES_VIEW), asyncHandler(controller.getSale));
