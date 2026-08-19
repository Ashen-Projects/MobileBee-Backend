import { eq } from 'drizzle-orm';

import { AppError } from '../../errors/app-error';
import { db } from '../../db';
import { permissions, rolePermissions, roles, userRoles, users } from '../../db/schema';

export type AuthenticatedUser = {
  defaultLocationId: number | null;
  displayName: string;
  email: string | null;
  firebaseUid: string;
  id: number;
  permissions: string[];
  roles: Array<{ id: number; label: string; name: string }>;
  username: string;
};

export const getAuthenticatedUser = async (firebaseUid: string): Promise<AuthenticatedUser> => {
  const [user] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid)).limit(1);

  if (!user) throw new AppError('This Firebase account is not registered in Mobee.', 403);
  if (!user.isActive) throw new AppError('Your Mobee account is inactive.', 403);

  const assignedRoles = await db
    .select({ id: roles.id, label: roles.label, name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id));

  const assignedPermissions = await db
    .selectDistinct({ key: permissions.key })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(userRoles.userId, user.id));

  return {
    defaultLocationId: user.defaultLocationId,
    displayName: user.displayName,
    email: user.email,
    firebaseUid: user.firebaseUid,
    id: user.id,
    permissions: assignedPermissions.map(({ key }) => key),
    roles: assignedRoles,
    username: user.username,
  };
};

export const recordSuccessfulLogin = async (firebaseUid: string): Promise<void> => {
  await db.update(users).set({ lastLoginAt: Date.now() }).where(eq(users.firebaseUid, firebaseUid));
};
