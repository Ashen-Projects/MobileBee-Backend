import { eq } from 'drizzle-orm';

import { db } from '..';
import { env } from '../../env';
import { firebaseAuth } from '../../services/auth/firebaseService';
import { locations, permissions, rolePermissions, roles, userRoles, users } from '../schema';

const getOrCreateFirebaseAdministrator = async () => {
  try {
    return await firebaseAuth.getUserByEmail(env.BOOTSTRAP_ADMIN_EMAIL);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== 'auth/user-not-found') throw error;

    return firebaseAuth.createUser({
      displayName: 'Mobee Administrator',
      email: env.BOOTSTRAP_ADMIN_EMAIL,
      emailVerified: true,
      password: env.BOOTSTRAP_ADMIN_PASSWORD,
    });
  }
};

export const seedDatabase = async (): Promise<void> => {
  const timestamp = Date.now();

  await db.insert(locations).values({
    code: 'HEAD_OFFICE',
    isActive: true,
    name: 'Head Office',
    timestamp,
    type: 'shop',
  }).onDuplicateKeyUpdate({ set: { isActive: true, name: 'Head Office' } });

  await db.insert(roles).values({
    description: 'System administrator with unrestricted access.',
    isSystem: true,
    label: 'Administrator',
    name: 'admin',
  }).onDuplicateKeyUpdate({ set: { isSystem: true, label: 'Administrator' } });

  await db.insert(permissions).values({
    description: 'Create and provision Mobee users.',
    key: 'users.create',
    module: 'users',
  }).onDuplicateKeyUpdate({ set: { description: 'Create and provision Mobee users.', module: 'users' } });

  const [[location], [adminRole], [createUserPermission], firebaseUser] = await Promise.all([
    db.select().from(locations).where(eq(locations.code, 'HEAD_OFFICE')).limit(1),
    db.select().from(roles).where(eq(roles.name, 'admin')).limit(1),
    db.select().from(permissions).where(eq(permissions.key, 'users.create')).limit(1),
    getOrCreateFirebaseAdministrator(),
  ]);

  if (!location || !adminRole || !createUserPermission) throw new Error('Failed to seed administrator prerequisites.');

  await db.insert(rolePermissions).values({
    permissionId: createUserPermission.id,
    roleId: adminRole.id,
  }).onDuplicateKeyUpdate({ set: { permissionId: createUserPermission.id } });

  await db.insert(users).values({
    defaultLocationId: location.id,
    displayName: firebaseUser.displayName ?? 'Mobee Administrator',
    email: env.BOOTSTRAP_ADMIN_EMAIL,
    firebaseUid: firebaseUser.uid,
    isActive: true,
    passwordHash: null,
    timestamp,
    username: env.BOOTSTRAP_ADMIN_EMAIL,
  }).onDuplicateKeyUpdate({
    set: {
      firebaseUid: firebaseUser.uid,
      isActive: true,
    },
  });

  const [administrator] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUser.uid)).limit(1);
  if (!administrator) throw new Error('Failed to seed the administrator user.');

  await db.insert(userRoles).values({
    assignedBy: administrator.id,
    locationId: location.id,
    roleId: adminRole.id,
    timestamp,
    userId: administrator.id,
  }).onDuplicateKeyUpdate({ set: { assignedBy: administrator.id, timestamp } });
};
