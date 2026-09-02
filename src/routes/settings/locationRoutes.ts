import { Router } from 'express';

import * as controller from '../../controllers/settings/locationController';
import { requirePermission } from '../../middlewares/permissionMiddleware';
import { asyncHandler } from '../../utils/async-handler';
import { USER_PERMISSIONS } from '../../utils/constants';

export const locationRoutes = Router();

locationRoutes.get('/', requirePermission(USER_PERMISSIONS.LOCATIONS_VIEW), asyncHandler(controller.listLocations));
locationRoutes.post('/', requirePermission(USER_PERMISSIONS.LOCATIONS_CREATE), asyncHandler(controller.createLocation));
locationRoutes.get('/:id', requirePermission(USER_PERMISSIONS.LOCATIONS_VIEW), asyncHandler(controller.getLocation));
locationRoutes.patch('/:id/status', requirePermission(USER_PERMISSIONS.LOCATIONS_UPDATE), asyncHandler(controller.setLocationStatus));
locationRoutes.patch('/:id', requirePermission(USER_PERMISSIONS.LOCATIONS_UPDATE), asyncHandler(controller.updateLocation));
