import { and, count, eq, inArray, like, or, type SQL } from 'drizzle-orm';

import { db } from '../../db';
import { auditLogs, locations, roles, userRoles, users } from '../../db/schema';
import { AppError } from '../../errors/app-error';
import { generateSecurePassword } from '../../utils/password';
import { USER_ROLES } from '../../utils/constants';
import type { AuthenticatedUser } from '../auth/authService';
import { firebaseAuth } from '../auth/firebaseService';
import {
  createUserSchema,
  listUsersSchema,
  updateUserSchema,
  updateUserLocationSchema,
  updateUserStatusSchema,
  userIdSchema,
} from './userValidation';

type AuditContext = { ipAddress?: string };

const normalizePhone = (phone: string | null | undefined): string | null => {
  const normalized = phone?.trim();
  return normalized ? normalized : null;
};

const findUser = async (id: number) => {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) throw new AppError('User not found.', 404);
  return user;
};

const assertEmailAvailable = async (email: string, excludedUserId?: number) => {
  const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existingUser && existingUser.id !== excludedUserId) {
    throw new AppError('A user with this email already exists.', 409);
  }
};

const throwFirebaseError = (error: unknown): never => {
  const code = (error as { code?: string }).code;
  if (code === 'auth/email-already-exists') throw new AppError('A user with this email already exists.', 409);
  if (code === 'auth/invalid-email') throw new AppError('The email address is invalid.', 400);
  if (code === 'auth/invalid-password') throw new AppError('The generated password was rejected.', 500);
  throw error;
};

export const listUsers = async (input: unknown) => {
  const query = listUsersSchema.parse(input);
  const filters: SQL[] = [];
  if (query.status !== 'all') filters.push(eq(users.isActive, query.status === 'active'));
  if (query.search) {
    const term = `%${query.search}%`;
    const searchFilter = or(
      like(users.firstName, term),
      like(users.lastName, term),
      like(users.displayName, term),
      like(users.email, term),
      like(users.phone, term),
    );
    if (searchFilter) filters.push(searchFilter);
  }

  const where = filters.length ? and(...filters) : undefined;
  const offset = (query.page - 1) * query.pageSize;
  const [[totalRow], userRows] = await Promise.all([
    db.select({ count: count() }).from(users).where(where),
    db
      .select({
        address: users.address,
        email: users.email,
        firstName: users.firstName,
        id: users.id,
        isActive: users.isActive,
        lastName: users.lastName,
        location: { id: locations.id, name: locations.name },
        name: users.displayName,
        phone: users.phone,
      })
      .from(users)
      .leftJoin(locations, eq(users.defaultLocationId, locations.id))
      .where(where)
      .orderBy(users.id)
      .limit(query.pageSize)
      .offset(offset),
  ]);

  const userIds = userRows.map(({ id }) => id);
  const roleRows = userIds.length
    ? await db
        .select({ label: roles.label, name: roles.name, userId: userRoles.userId })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(inArray(userRoles.userId, userIds))
    : [];
  const rolesByUser = new Map<number, Array<{ label: string; name: string }>>();
  roleRows.forEach(({ userId, ...role }) => {
    rolesByUser.set(userId, [...(rolesByUser.get(userId) ?? []), role]);
  });

  const total = totalRow?.count ?? 0;
  return {
    items: userRows.map((user) => ({ ...user, roles: rolesByUser.get(user.id) ?? [] })),
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
  };
};

export const createUser = async (
  input: unknown,
  administrator: AuthenticatedUser,
  context: AuditContext = {},
) => {
  const data = createUserSchema.parse(input);
  const displayName = `${data.firstName} ${data.lastName}`;
  const password = generateSecurePassword();
  await assertEmailAvailable(data.email);
  const [pendingRole] = await db.select({ id: roles.id }).from(roles)
    .where(eq(roles.name, USER_ROLES.PENDING)).limit(1);
  if (!pendingRole) throw new AppError('Pending User role is not initialized.', 500);
  if (!administrator.defaultLocationId) throw new AppError('Administrator does not have a default location.', 400);

  let firebaseUser!: Awaited<ReturnType<typeof firebaseAuth.createUser>>;
  try {
    firebaseUser = await firebaseAuth.createUser({
      disabled: false,
      displayName,
      email: data.email,
      emailVerified: false,
      password,
    });
  } catch (error) {
    throwFirebaseError(error);
  }

  try {
    const userId = await db.transaction(async (transaction) => {
      const result = await transaction.insert(users).values({
        defaultLocationId: null,
        address: null,
        displayName,
        email: data.email,
        firebaseUid: firebaseUser.uid,
        firstName: data.firstName,
        isActive: true,
        lastName: data.lastName,
        passwordHash: null,
        phone: null,
        timestamp: Date.now(),
        username: data.email,
      });
      const insertedUserId = Number(result[0].insertId);
      await transaction.insert(userRoles).values({
        assignedBy: administrator.id,
        locationId: administrator.defaultLocationId,
        roleId: pendingRole.id,
        timestamp: Date.now(),
        userId: insertedUserId,
      });
      await transaction.insert(auditLogs).values({
        action: 'create', entityId: insertedUserId, entityType: 'user', ipAddress: context.ipAddress,
        module: 'users', newValues: { email: data.email, firstName: data.firstName, isActive: true, lastName: data.lastName, role: USER_ROLES.PENDING },
        timestamp: Date.now(), userId: administrator.id,
      });
      return insertedUserId;
    });
    return {
      credentials: { email: data.email, password },
      user: { email: data.email, firstName: data.firstName, id: userId, isActive: true, lastName: data.lastName },
    };
  } catch (error) {
    await firebaseAuth.deleteUser(firebaseUser.uid).catch(() => undefined);
    throw error;
  }
};

export const updateUser = async (
  idInput: unknown,
  input: unknown,
  administrator: AuthenticatedUser,
  context: AuditContext = {},
) => {
  const id = userIdSchema.parse(idInput);
  const data = updateUserSchema.parse(input);
  const current = await findUser(id);
  const address = data.address === undefined ? current.address : (data.address?.trim() || null);
  const phone = data.phone === undefined ? current.phone : normalizePhone(data.phone);

  await db.transaction(async (transaction) => {
    await transaction.update(users).set({ address, phone }).where(eq(users.id, id));
    await transaction.insert(auditLogs).values({
      action: 'update_profile', entityId: id, entityType: 'user', ipAddress: context.ipAddress, module: 'users',
      newValues: { address, phone }, oldValues: { address: current.address, phone: current.phone },
      timestamp: Date.now(), userId: administrator.id,
    });
  });
  return { address, displayName: current.displayName, email: current.email, firstName: current.firstName, id, lastName: current.lastName, phone };
};

export const getOwnProfile = async (authenticatedUser: AuthenticatedUser) => {
  const current = await findUser(authenticatedUser.id);
  return {
    address: current.address,
    displayName: current.displayName,
    email: current.email,
    firstName: current.firstName,
    id: current.id,
    lastName: current.lastName,
    phone: current.phone,
  };
};

export const updateOwnProfile = async (
  input: unknown,
  authenticatedUser: AuthenticatedUser,
  context: AuditContext = {},
) => updateUser(authenticatedUser.id, input, authenticatedUser, context);

export const updateUserStatus = async (
  idInput: unknown,
  input: unknown,
  administrator: AuthenticatedUser,
  context: AuditContext = {},
) => {
  const id = userIdSchema.parse(idInput);
  const { isActive } = updateUserStatusSchema.parse(input);
  if (id === administrator.id && !isActive) throw new AppError('You cannot deactivate your own account.', 400);
  const current = await findUser(id);
  if (current.isActive === isActive) return { id, isActive };

  await firebaseAuth.updateUser(current.firebaseUid, { disabled: !isActive });
  try {
    await db.transaction(async (transaction) => {
      await transaction.update(users).set({ isActive }).where(eq(users.id, id));
      await transaction.insert(auditLogs).values({
        action: isActive ? 'activate' : 'deactivate', entityId: id, entityType: 'user', ipAddress: context.ipAddress,
        module: 'users', newValues: { isActive }, oldValues: { isActive: current.isActive },
        timestamp: Date.now(), userId: administrator.id,
      });
    });
  } catch (error) {
    await firebaseAuth.updateUser(current.firebaseUid, { disabled: !current.isActive }).catch(() => undefined);
    throw error;
  }
  if (!isActive) await firebaseAuth.revokeRefreshTokens(current.firebaseUid);
  return { id, isActive };
};

export const updateUserLocation = async (
  idInput: unknown,
  input: unknown,
  administrator: AuthenticatedUser,
  context: AuditContext = {},
) => {
  const id = userIdSchema.parse(idInput);
  const { locationId } = updateUserLocationSchema.parse(input);
  const current = await findUser(id);
  const [location] = await db.select({ id: locations.id, isActive: locations.isActive, name: locations.name })
    .from(locations).where(eq(locations.id, locationId)).limit(1);
  if (!location || !location.isActive) throw new AppError('The selected location does not exist or is inactive.', 400);

  await db.transaction(async (transaction) => {
    await transaction.update(users).set({ defaultLocationId: locationId }).where(eq(users.id, id));
    await transaction.update(userRoles).set({ locationId }).where(eq(userRoles.userId, id));
    await transaction.insert(auditLogs).values({
      action: 'assign_location', entityId: id, entityType: 'user', ipAddress: context.ipAddress,
      module: 'users', newValues: { locationId, locationName: location.name },
      oldValues: { locationId: current.defaultLocationId }, timestamp: Date.now(), userId: administrator.id,
    });
  });
  return { id, location: { id: location.id, name: location.name } };
};

export const regenerateUserCredentials = async (
  idInput: unknown,
  administrator: AuthenticatedUser,
  context: AuditContext = {},
) => {
  const id = userIdSchema.parse(idInput);
  const current = await findUser(id);
  if (!current.email) throw new AppError('This user does not have an email address.', 400);
  if (!current.isActive) throw new AppError('Activate this user before resetting credentials.', 400);

  const password = generateSecurePassword();
  await firebaseAuth.updateUser(current.firebaseUid, { password });
  await firebaseAuth.revokeRefreshTokens(current.firebaseUid);
  await db.insert(auditLogs).values({
    action: 'reset_credentials', entityId: id, entityType: 'user', ipAddress: context.ipAddress,
    module: 'users', newValues: { sessionsRevoked: true }, timestamp: Date.now(), userId: administrator.id,
  });
  return { credentials: { email: current.email, password } };
};
