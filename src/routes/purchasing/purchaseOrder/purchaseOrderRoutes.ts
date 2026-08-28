import { Router } from 'express';

import * as controller from '../../../controllers/purchasing/purchaseOrder/purchaseOrderController';
import { requirePermission } from '../../../middlewares/permissionMiddleware';
import { asyncHandler } from '../../../utils/async-handler';
import { USER_PERMISSIONS } from '../../../utils/constants';

export const purchaseOrderRoutes = Router();

purchaseOrderRoutes.get('/statuses', requirePermission(USER_PERMISSIONS.PURCHASE_ORDERS_VIEW), asyncHandler(controller.listPurchaseOrderStatuses));
purchaseOrderRoutes.get('/', requirePermission(USER_PERMISSIONS.PURCHASE_ORDERS_VIEW), asyncHandler(controller.listPurchaseOrders));
purchaseOrderRoutes.post('/', requirePermission(USER_PERMISSIONS.PURCHASE_ORDERS_CREATE), asyncHandler(controller.createPurchaseOrder));
purchaseOrderRoutes.get('/:id', requirePermission(USER_PERMISSIONS.PURCHASE_ORDERS_VIEW), asyncHandler(controller.getPurchaseOrder));
purchaseOrderRoutes.patch('/:id', requirePermission(USER_PERMISSIONS.PURCHASE_ORDERS_UPDATE), asyncHandler(controller.updatePurchaseOrder));
purchaseOrderRoutes.post('/:id/submit', requirePermission(USER_PERMISSIONS.PURCHASE_ORDERS_SUBMIT), asyncHandler(controller.submitPurchaseOrder));
purchaseOrderRoutes.post('/:id/approve', requirePermission(USER_PERMISSIONS.PURCHASE_ORDERS_APPROVE), asyncHandler(controller.approvePurchaseOrder));
purchaseOrderRoutes.post('/:id/reject', requirePermission(USER_PERMISSIONS.PURCHASE_ORDERS_APPROVE), asyncHandler(controller.rejectPurchaseOrder));
purchaseOrderRoutes.post('/:id/order', requirePermission(USER_PERMISSIONS.PURCHASE_ORDERS_ORDER), asyncHandler(controller.markPurchaseOrderOrdered));
purchaseOrderRoutes.post('/:id/cancel', requirePermission(USER_PERMISSIONS.PURCHASE_ORDERS_CANCEL), asyncHandler(controller.cancelPurchaseOrder));

