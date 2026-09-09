import { Router } from 'express';

import { overview } from '../../controllers/dashboard/dashboardController';
import * as controlsController from '../../controllers/dashboard/dashboardControlsController';
import { requirePermission } from '../../middlewares/permissionMiddleware';
import { asyncHandler } from '../../utils/async-handler';
import { USER_PERMISSIONS } from '../../utils/constants';

export const dashboardRoutes = Router();

dashboardRoutes.get('/overview', requirePermission(USER_PERMISSIONS.DASHBOARD_VIEW), asyncHandler(overview));
dashboardRoutes.get('/controls', requirePermission(USER_PERMISSIONS.DASHBOARD_CONTROLS_VIEW), asyncHandler(controlsController.getControls));
dashboardRoutes.put('/controls/targets', requirePermission(USER_PERMISSIONS.DASHBOARD_CONTROLS_UPDATE), asyncHandler(controlsController.saveTarget));
dashboardRoutes.put('/controls/insight-settings', requirePermission(USER_PERMISSIONS.DASHBOARD_CONTROLS_UPDATE), asyncHandler(controlsController.saveSettings));
dashboardRoutes.post('/insights/:insightId/action', requirePermission(USER_PERMISSIONS.DASHBOARD_INSIGHTS_ACTION), asyncHandler(controlsController.saveInsightAction));
