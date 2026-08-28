import { Router } from 'express';

import * as controller from '../../../controllers/purchasing/supplier/supplierController';
import { requirePermission } from '../../../middlewares/permissionMiddleware';
import { asyncHandler } from '../../../utils/async-handler';
import { USER_PERMISSIONS } from '../../../utils/constants';

export const supplierRoutes = Router();

supplierRoutes.get('/', requirePermission(USER_PERMISSIONS.SUPPLIERS_VIEW), asyncHandler(controller.listSuppliers));
supplierRoutes.post('/reserve-code', requirePermission(USER_PERMISSIONS.SUPPLIERS_CREATE), asyncHandler(controller.reserveSupplierCode));
supplierRoutes.post('/', requirePermission(USER_PERMISSIONS.SUPPLIERS_CREATE), asyncHandler(controller.createSupplier));
supplierRoutes.get('/:id', requirePermission(USER_PERMISSIONS.SUPPLIERS_VIEW), asyncHandler(controller.getSupplier));
supplierRoutes.patch('/:id/status', requirePermission(USER_PERMISSIONS.SUPPLIERS_UPDATE), asyncHandler(controller.setSupplierStatus));
supplierRoutes.patch('/:id', requirePermission(USER_PERMISSIONS.SUPPLIERS_UPDATE), asyncHandler(controller.updateSupplier));
supplierRoutes.put('/:id/products/:productId', requirePermission(USER_PERMISSIONS.SUPPLIERS_UPDATE), asyncHandler(controller.upsertSupplierProduct));
supplierRoutes.patch('/:id/products/:productId/status', requirePermission(USER_PERMISSIONS.SUPPLIERS_UPDATE), asyncHandler(controller.setSupplierProductStatus));
