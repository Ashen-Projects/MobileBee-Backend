import { and, count, desc, eq, gt, isNull, or, sql, type SQL } from 'drizzle-orm';

import { db } from '../../db';
import { notificationReads, notifications, userRoles } from '../../db/schema';
import { AppError } from '../../errors/app-error';
import type { AuthenticatedUser } from '../auth/authService';
import { USER_ROLES } from '../../utils/constants';
import { createNotificationSchema, notificationIdSchema, notificationListQuerySchema, type CreateNotificationInput } from './notificationValidation';

const isAdmin = (user: AuthenticatedUser) => user.roles.some((role) => role.name === USER_ROLES.ADMIN);

const canSeeLocation = async (user: AuthenticatedUser, locationId: number | null) => {
  if (!locationId || isAdmin(user)) return true;
  if (user.defaultLocationId === locationId) return true;
  const [assignment] = await db.select({ userId: userRoles.userId }).from(userRoles)
    .where(and(eq(userRoles.userId, user.id), eq(userRoles.locationId, locationId)))
    .limit(1);
  return Boolean(assignment);
};

const visibilityFilters = (user: AuthenticatedUser): SQL[] => {
  const filters: SQL[] = [
    or(isNull(notifications.expiresAt), gt(notifications.expiresAt, Date.now()))!,
    or(isNull(notifications.targetUserId), eq(notifications.targetUserId, user.id))!,
  ];

  if (!isAdmin(user)) {
    const permissionConditions = user.permissions.map((permission) => eq(notifications.targetPermission, permission));
    filters.push(or(isNull(notifications.targetPermission), ...permissionConditions)!);
    const locationConditions = [isNull(notifications.locationId)];
    if (user.defaultLocationId) locationConditions.push(eq(notifications.locationId, user.defaultLocationId));
    filters.push(or(...locationConditions)!);
  }

  return filters;
};

export const createNotification = async (input: CreateNotificationInput, createdBy?: number) => {
  const data = createNotificationSchema.parse(input);
  const result = await db.insert(notifications).values({
    createdBy: createdBy ?? null,
    entityId: data.entityId ?? null,
    entityType: data.entityType ?? null,
    locationId: data.locationId ?? null,
    message: data.message,
    module: data.module,
    severity: data.severity,
    targetPermission: data.targetPermission ?? null,
    targetUserId: data.targetUserId ?? null,
    timestamp: Date.now(),
    title: data.title,
  });
  return Number(result[0].insertId);
};

export const safeCreateNotification = async (input: CreateNotificationInput, createdBy?: number) => {
  try {
    await createNotification(input, createdBy);
  } catch {
    // Notifications must never break the business transaction that triggered them.
  }
};

export const listNotifications = async (input: unknown, user: AuthenticatedUser) => {
  const query = notificationListQuerySchema.parse(input);
  const offset = (query.page - 1) * query.pageSize;
  const readExists = sql<number>`exists(select 1 from ${notificationReads} where ${notificationReads.notificationId} = ${notifications.id} and ${notificationReads.userId} = ${user.id})`;
  const baseFilters = visibilityFilters(user);
  if (query.status === 'read') baseFilters.push(sql`${readExists} = 1`);
  if (query.status === 'unread') baseFilters.push(sql`${readExists} = 0`);
  const where = and(...baseFilters);

  const [items, [{ total }]] = await Promise.all([
    db.select({
      entityId: notifications.entityId,
      entityType: notifications.entityType,
      id: notifications.id,
      isRead: sql<boolean>`${readExists}`,
      locationId: notifications.locationId,
      message: notifications.message,
      module: notifications.module,
      severity: notifications.severity,
      timestamp: notifications.timestamp,
      title: notifications.title,
    }).from(notifications).where(where).orderBy(desc(notifications.timestamp)).limit(query.pageSize).offset(offset),
    db.select({ total: count() }).from(notifications).where(where),
  ]);

  return { items, pagination: { page: query.page, pageSize: query.pageSize, total: Number(total), totalPages: Math.ceil(Number(total) / query.pageSize) } };
};

export const getUnreadCount = async (user: AuthenticatedUser) => {
  const readExists = sql<number>`exists(select 1 from ${notificationReads} where ${notificationReads.notificationId} = ${notifications.id} and ${notificationReads.userId} = ${user.id})`;
  const [{ total }] = await db.select({ total: count() }).from(notifications)
    .where(and(...visibilityFilters(user), sql`${readExists} = 0`));
  return Number(total);
};

export const markNotificationRead = async (input: unknown, user: AuthenticatedUser) => {
  const id = notificationIdSchema.parse(input);
  const [notification] = await db.select({ id: notifications.id, locationId: notifications.locationId }).from(notifications)
    .where(and(eq(notifications.id, id), ...visibilityFilters(user)))
    .limit(1);
  if (!notification) throw new AppError('Notification not found.', 404);
  if (!(await canSeeLocation(user, notification.locationId))) throw new AppError('Notification not found.', 404);
  await db.insert(notificationReads).values({ notificationId: id, readAt: Date.now(), userId: user.id }).onDuplicateKeyUpdate({ set: { readAt: Date.now() } });
  return { id };
};

export const markAllRead = async (user: AuthenticatedUser) => {
  const rows = await db.select({ id: notifications.id, locationId: notifications.locationId }).from(notifications).where(and(...visibilityFilters(user)));
  const readableRows = [];
  for (const row of rows) {
    if (await canSeeLocation(user, row.locationId)) readableRows.push(row);
  }
  if (readableRows.length) {
    await db.insert(notificationReads).values(readableRows.map((row) => ({ notificationId: row.id, readAt: Date.now(), userId: user.id })))
      .onDuplicateKeyUpdate({ set: { readAt: Date.now() } });
  }
  return { updated: readableRows.length };
};
