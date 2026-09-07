import { Router } from 'express';

import * as controller from '../../controllers/product/productController';
import { requirePermission } from '../../middlewares/permissionMiddleware';
import { asyncHandler } from '../../utils/async-handler';
import { USER_PERMISSIONS } from '../../utils/constants';

export const productRoutes = Router();

productRoutes.get('/categories', requirePermission(USER_PERMISSIONS.PRODUCT_CATEGORIES_VIEW), asyncHandler(controller.listCategories));
productRoutes.post('/categories', requirePermission(USER_PERMISSIONS.PRODUCT_CATEGORIES_CREATE), asyncHandler(controller.createCategory));
productRoutes.patch('/categories/:id/status', requirePermission(USER_PERMISSIONS.PRODUCT_CATEGORIES_UPDATE), asyncHandler(controller.setCategoryStatus));
productRoutes.patch('/categories/:id', requirePermission(USER_PERMISSIONS.PRODUCT_CATEGORIES_UPDATE), asyncHandler(controller.updateCategory));

productRoutes.get('/attributes', requirePermission(USER_PERMISSIONS.PRODUCT_ATTRIBUTES_VIEW), asyncHandler(controller.listAttributes));
productRoutes.post('/attributes', requirePermission(USER_PERMISSIONS.PRODUCT_ATTRIBUTES_CREATE), asyncHandler(controller.createAttribute));
productRoutes.patch('/attributes/:id/status', requirePermission(USER_PERMISSIONS.PRODUCT_ATTRIBUTES_UPDATE), asyncHandler(controller.setAttributeStatus));
productRoutes.patch('/attributes/:id', requirePermission(USER_PERMISSIONS.PRODUCT_ATTRIBUTES_UPDATE), asyncHandler(controller.updateAttribute));
productRoutes.post('/attributes/:attributeId/options', requirePermission(USER_PERMISSIONS.PRODUCT_ATTRIBUTES_CREATE), asyncHandler(controller.createAttributeOption));
productRoutes.patch('/attribute-options/:id/status', requirePermission(USER_PERMISSIONS.PRODUCT_ATTRIBUTES_UPDATE), asyncHandler(controller.setAttributeOptionStatus));
productRoutes.patch('/attribute-options/:id', requirePermission(USER_PERMISSIONS.PRODUCT_ATTRIBUTES_UPDATE), asyncHandler(controller.updateAttributeOption));

productRoutes.get('/', requirePermission(USER_PERMISSIONS.PRODUCTS_VIEW), asyncHandler(controller.listProducts));
productRoutes.post('/', requirePermission(USER_PERMISSIONS.PRODUCTS_CREATE), asyncHandler(controller.createProduct));
productRoutes.get('/stock-level-locations', requirePermission(USER_PERMISSIONS.PRODUCTS_VIEW), asyncHandler(controller.listStockLevelLocations));
productRoutes.get('/:id', requirePermission(USER_PERMISSIONS.PRODUCTS_VIEW), asyncHandler(controller.getProduct));
productRoutes.patch('/:id/status', requirePermission(USER_PERMISSIONS.PRODUCTS_UPDATE), asyncHandler(controller.setProductStatus));
productRoutes.patch('/:id', requirePermission(USER_PERMISSIONS.PRODUCTS_UPDATE), asyncHandler(controller.updateProduct));
