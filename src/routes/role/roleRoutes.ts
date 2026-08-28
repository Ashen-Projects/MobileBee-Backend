import { Router } from 'express';

import * as controller from '../../controllers/role/roleController';
import { requirePermission, requireRole } from '../../middlewares/permissionMiddleware';
import { asyncHandler } from '../../utils/async-handler';
import { USER_PERMISSIONS, USER_ROLES } from '../../utils/constants';

export const roleRoutes = Router();
const adminOnly = requireRole(USER_ROLES.ADMIN);

roleRoutes.use(adminOnly);
roleRoutes.get('/assignment-locations', requirePermission(USER_PERMISSIONS.USERS_ASSIGN_ROLES), asyncHandler(controller.listAssignableLocations));
roleRoutes.get('/permissions', requirePermission(USER_PERMISSIONS.ROLES_VIEW), asyncHandler(controller.listPermissions));
roleRoutes.post('/permissions', requirePermission(USER_PERMISSIONS.PERMISSIONS_CREATE), asyncHandler(controller.createPermission));
roleRoutes.patch('/permissions/:id', requirePermission(USER_PERMISSIONS.PERMISSIONS_UPDATE), asyncHandler(controller.updatePermission));
roleRoutes.delete('/permissions/:id', requirePermission(USER_PERMISSIONS.PERMISSIONS_DELETE), asyncHandler(controller.deletePermission));
roleRoutes.get('/', requirePermission(USER_PERMISSIONS.ROLES_VIEW), asyncHandler(controller.listRoles));
roleRoutes.get('/:id', requirePermission(USER_PERMISSIONS.ROLES_VIEW), asyncHandler(controller.getRole));
roleRoutes.post('/', requirePermission(USER_PERMISSIONS.ROLES_CREATE), asyncHandler(controller.createRole));
roleRoutes.patch('/:id', requirePermission(USER_PERMISSIONS.ROLES_UPDATE), asyncHandler(controller.updateRole));
roleRoutes.put('/:id/permissions', requirePermission(USER_PERMISSIONS.ROLES_ASSIGN_PERMISSIONS), asyncHandler(controller.replaceRolePermissions));
roleRoutes.delete('/:id', requirePermission(USER_PERMISSIONS.ROLES_DELETE), asyncHandler(controller.deleteRole));
