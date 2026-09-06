import { Router } from 'express';

import * as controller from '../../controllers/customer/customerController';
import { requirePermission } from '../../middlewares/permissionMiddleware';
import { asyncHandler } from '../../utils/async-handler';
import { USER_PERMISSIONS } from '../../utils/constants';

export const customerRoutes = Router();

customerRoutes.get('/', requirePermission(USER_PERMISSIONS.CUSTOMERS_VIEW), asyncHandler(controller.listCustomers));
customerRoutes.post('/', requirePermission(USER_PERMISSIONS.CUSTOMERS_CREATE), asyncHandler(controller.createCustomer));
customerRoutes.get('/:id', requirePermission(USER_PERMISSIONS.CUSTOMERS_VIEW), asyncHandler(controller.getCustomer));
customerRoutes.patch('/:id/status', requirePermission(USER_PERMISSIONS.CUSTOMERS_UPDATE), asyncHandler(controller.updateCustomerStatus));
customerRoutes.patch('/:id', requirePermission(USER_PERMISSIONS.CUSTOMERS_UPDATE), asyncHandler(controller.updateCustomer));
