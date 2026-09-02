import { Router } from 'express';

import * as controller from '../../../controllers/purchasing/grn/grnController';
import { requirePermission } from '../../../middlewares/permissionMiddleware';
import { asyncHandler } from '../../../utils/async-handler';
import { USER_PERMISSIONS } from '../../../utils/constants';

export const grnRoutes = Router();

grnRoutes.get('/', requirePermission(USER_PERMISSIONS.GRNS_VIEW), asyncHandler(controller.listGrns));
grnRoutes.post('/', requirePermission(USER_PERMISSIONS.GRNS_CREATE), asyncHandler(controller.createGrn));
grnRoutes.get('/:id', requirePermission(USER_PERMISSIONS.GRNS_VIEW), asyncHandler(controller.getGrn));
grnRoutes.post('/:id/counts', requirePermission(USER_PERMISSIONS.GRNS_COUNT), asyncHandler(controller.verifyGrnCount));
grnRoutes.post('/:id/finance-decision', requirePermission(USER_PERMISSIONS.GRNS_FINANCE_APPROVE), asyncHandler(controller.decideGrnFinance));
grnRoutes.post('/:id/add-to-stock', requirePermission(USER_PERMISSIONS.GRNS_STOCK_ADD), asyncHandler(controller.addGrnStock));
grnRoutes.post('/:id/documents', requirePermission(USER_PERMISSIONS.GRNS_DOCUMENTS), asyncHandler(controller.addGrnDocuments));
grnRoutes.post('/:id/notes', requirePermission(USER_PERMISSIONS.GRNS_DOCUMENTS), asyncHandler(controller.addGrnNote));
