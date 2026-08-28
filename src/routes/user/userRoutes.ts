import { Router } from 'express';

import { requirePermission, requireRole } from '../../middlewares/permissionMiddleware';
import { asyncHandler } from '../../utils/async-handler';
import { USER_ACCESS, USER_PERMISSIONS, USER_ROLES } from '../../utils/constants';
import {
  createUser,
  getOwnProfile,
  listUsers,
  regenerateUserCredentials,
  updateUser,
  updateUserStatus,
  updateUserLocation,
  updateOwnProfile,
} from '../../controllers/user/userController';
import { getUserRoleAssignments, replaceUserRoles } from '../../controllers/role/roleController';

export const userRoutes = Router();

const adminOnly = requireRole(USER_ROLES.ADMIN);

userRoutes.get('/me', requirePermission(USER_ACCESS.GENERAL_DATA), asyncHandler(getOwnProfile));
userRoutes.patch('/me', requirePermission(USER_ACCESS.GENERAL_DATA), asyncHandler(updateOwnProfile));
userRoutes.get('/', adminOnly, requirePermission(USER_PERMISSIONS.USERS_VIEW), asyncHandler(listUsers));
userRoutes.post('/', adminOnly, requirePermission(USER_PERMISSIONS.USERS_CREATE), asyncHandler(createUser));
userRoutes.patch('/:id', adminOnly, requirePermission(USER_PERMISSIONS.USERS_UPDATE), asyncHandler(updateUser));
userRoutes.patch('/:id/status', adminOnly, requirePermission(USER_PERMISSIONS.USERS_UPDATE), asyncHandler(updateUserStatus));
userRoutes.patch('/:id/location', adminOnly, requirePermission(USER_PERMISSIONS.USERS_UPDATE), asyncHandler(updateUserLocation));
userRoutes.get('/:id/roles', adminOnly, requirePermission(USER_PERMISSIONS.USERS_ASSIGN_ROLES), asyncHandler(getUserRoleAssignments));
userRoutes.put('/:id/roles', adminOnly, requirePermission(USER_PERMISSIONS.USERS_ASSIGN_ROLES), asyncHandler(replaceUserRoles));
userRoutes.post(
  '/:id/credentials/reset',
  adminOnly,
  requirePermission(USER_PERMISSIONS.USERS_UPDATE),
  asyncHandler(regenerateUserCredentials),
);
