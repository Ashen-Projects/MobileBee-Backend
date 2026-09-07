import { eq } from 'drizzle-orm';

import { db } from '../../db';
import { locations } from '../../db/schema';
import { AppError } from '../../errors/app-error';
import { USER_ROLES } from '../../utils/constants';
import type { AuthenticatedUser } from '../auth/authService';

export type LocationScope = number | 'all';

export const isAdministrator = (user: AuthenticatedUser) =>
  user.roles.some(({ name }) => name === USER_ROLES.ADMIN);

export const resolveLocationScope = async (
  requestedLocationId: LocationScope,
  user: AuthenticatedUser,
): Promise<LocationScope> => {
  if (!isAdministrator(user)) {
    if (!user.defaultLocationId) {
      throw new AppError('Your account does not have an assigned location.', 400);
    }
    if (requestedLocationId !== 'all' && requestedLocationId !== user.defaultLocationId) {
      throw new AppError('You do not have access to the requested location.', 403);
    }
    return user.defaultLocationId;
  }

  if (requestedLocationId === 'all') return 'all';
  const [location] = await db.select({ id: locations.id }).from(locations)
    .where(eq(locations.id, requestedLocationId)).limit(1);
  if (!location) throw new AppError('Location not found.', 404);
  return location.id;
};
