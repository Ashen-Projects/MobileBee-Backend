import { Router } from 'express';

import * as controller from '../../controllers/settings/documentSequenceController';
import { requirePermission } from '../../middlewares/permissionMiddleware';
import { asyncHandler } from '../../utils/async-handler';
import { USER_PERMISSIONS } from '../../utils/constants';

export const documentSequenceRoutes = Router();

documentSequenceRoutes.get('/', requirePermission(USER_PERMISSIONS.DOCUMENT_SEQUENCES_VIEW), asyncHandler(controller.listDocumentSequences));
documentSequenceRoutes.post('/', requirePermission(USER_PERMISSIONS.DOCUMENT_SEQUENCES_CREATE), asyncHandler(controller.createDocumentSequence));
documentSequenceRoutes.get('/:id', requirePermission(USER_PERMISSIONS.DOCUMENT_SEQUENCES_VIEW), asyncHandler(controller.getDocumentSequence));
documentSequenceRoutes.patch('/:id', requirePermission(USER_PERMISSIONS.DOCUMENT_SEQUENCES_UPDATE), asyncHandler(controller.updateDocumentSequence));
