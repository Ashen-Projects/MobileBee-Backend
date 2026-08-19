import { inArray } from 'drizzle-orm';

import { AppError } from '../../errors/app-error';
import { db } from '../../db';
import { locations, roles, userRoles, users } from '../../db/schema';
import type { AuthenticatedUser } from '../auth/authService';
import { createUserSchema } from '../auth/authValidation';
import { firebaseAuth } from '../auth/firebaseService';
import { generateSecurePassword } from '../../utils/password';

export const createUser = async (input: unknown, administrator: AuthenticatedUser) => {
  const data = createUserSchema.parse(input);
  const password = data.password ?? generateSecurePassword();

  const [validRoles, validLocations] = await Promise.all([
    db.select({ id: roles.id }).from(roles).where(inArray(roles.id, data.roleIds)),
    db.select({ id: locations.id }).from(locations).where(inArray(locations.id, [data.defaultLocationId])),
  ]);

  if (validRoles.length !== new Set(data.roleIds).size) throw new AppError('One or more roles are invalid.', 400);
  if (validLocations.length !== 1) throw new AppError('The selected location is invalid.', 400);

  let firebaseUser;
  try {
    firebaseUser = await firebaseAuth.createUser({
      disabled: false,
      displayName: data.displayName,
      email: data.email,
      emailVerified: false,
      password,
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'auth/email-already-exists') throw new AppError('A user with this email already exists.', 409);
    if (code === 'auth/invalid-password') throw new AppError('The password does not meet Firebase requirements.', 400);
    throw error;
  }

  try {
    const userId = await db.transaction(async (transaction) => {
      const result = await transaction.insert(users).values({
        defaultLocationId: data.defaultLocationId,
        displayName: data.displayName,
        email: data.email,
        firebaseUid: firebaseUser.uid,
        isActive: true,
        passwordHash: null,
        phone: data.phone,
        timestamp: Date.now(),
        username: data.username,
      });
      const insertedUserId = Number(result[0].insertId);

      await transaction.insert(userRoles).values(
        [...new Set(data.roleIds)].map((roleId) => ({
          assignedBy: administrator.id,
          locationId: data.defaultLocationId,
          roleId,
          timestamp: Date.now(),
          userId: insertedUserId,
        })),
      );

      return insertedUserId;
    });

    return {
      generatedPassword: data.password ? undefined : password,
      user: { id: userId, email: data.email, firebaseUid: firebaseUser.uid, username: data.username },
    };
  } catch (error) {
    await firebaseAuth.deleteUser(firebaseUser.uid).catch(() => undefined);
    throw error;
  }
};
