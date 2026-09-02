import { and, asc, count, eq, like, ne, or } from 'drizzle-orm';

import { db } from '../../db';
import { auditLogs, documentSequences, locations, purchaseOrders, purchaseOrderStatuses, userRoles, users } from '../../db/schema';
import { AppError } from '../../errors/app-error';
import { DOCUMENT_SEQUENCE_DEFAULTS, TIME_ZONE } from '../../utils/constants';
import type { AuthenticatedUser } from '../auth/authService';
import {
  createLocationSchema,
  listLocationsSchema,
  locationIdSchema,
  updateLocationSchema,
  updateLocationStatusSchema,
} from './locationValidation';

type AuditContext = { ipAddress?: string };

const findLocation = async (id: number) => {
  const [location] = await db.select().from(locations).where(eq(locations.id, id)).limit(1);
  if (!location) throw new AppError('Location not found.', 404);
  return location;
};

const assertUnique = async (code: string, name: string, excludedId?: number) => {
  const duplicate = or(eq(locations.code, code), eq(locations.name, name));
  const [row] = await db.select({ code: locations.code, id: locations.id, name: locations.name })
    .from(locations).where(excludedId ? and(ne(locations.id, excludedId), duplicate) : duplicate).limit(1);
  if (!row) return;
  throw new AppError(row.code === code ? 'A location with this code already exists.' : 'A location with this name already exists.', 409);
};

const audit = (user: AuthenticatedUser, context: AuditContext, action: string, entityId: number, oldValues?: unknown, newValues?: unknown) => ({
  action,
  entityId,
  entityType: 'location',
  ipAddress: context.ipAddress,
  module: 'locations',
  newValues,
  oldValues,
  timestamp: Date.now(),
  userId: user.id,
});

export const listLocations = async (input: unknown) => {
  const query = listLocationsSchema.parse(input);
  const filters = [];
  if (query.isActive !== 'all') filters.push(eq(locations.isActive, query.isActive === 'true'));
  if (query.type !== 'all') filters.push(eq(locations.type, query.type));
  if (query.search) filters.push(or(
    like(locations.code, `%${query.search}%`),
    like(locations.name, `%${query.search}%`),
    like(locations.phone, `%${query.search}%`),
  ));
  const where = filters.length ? and(...filters) : undefined;
  const offset = (query.page - 1) * query.pageSize;
  const [items, [{ total }]] = await Promise.all([
    db.select().from(locations).where(where).orderBy(asc(locations.name)).limit(query.pageSize).offset(offset),
    db.select({ total: count() }).from(locations).where(where),
  ]);
  return {
    items,
    pagination: { page: query.page, pageSize: query.pageSize, total: Number(total), totalPages: Math.ceil(Number(total) / query.pageSize) },
  };
};

export const getLocation = async (input: unknown) => {
  const location = await findLocation(locationIdSchema.parse(input));
  const [[{ assignedUsers }], [{ roleAssignments }]] = await Promise.all([
    db.select({ assignedUsers: count() }).from(users).where(eq(users.defaultLocationId, location.id)),
    db.select({ roleAssignments: count() }).from(userRoles).where(eq(userRoles.locationId, location.id)),
  ]);
  return { ...location, assignedUsers: Number(assignedUsers), roleAssignments: Number(roleAssignments) };
};

export const createLocation = async (input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const data = createLocationSchema.parse(input);
  await assertUnique(data.code, data.name);
  const sequenceYear = Number(new Intl.DateTimeFormat('en', {
    timeZone: TIME_ZONE,
    year: 'numeric',
  }).format(new Date()));
  const id = await db.transaction(async (transaction) => {
    const result = await transaction.insert(locations).values({ ...data, timestamp: Date.now() });
    const locationId = Number(result[0].insertId);
    await transaction.insert(documentSequences).values(DOCUMENT_SEQUENCE_DEFAULTS.map((sequence) => ({
      ...sequence,
      lastNumber: 0,
      locationId,
      year: sequenceYear,
    })));
    await transaction.insert(auditLogs).values(audit(user, context, 'create', locationId, undefined, data));
    return locationId;
  });
  return getLocation(id);
};

export const updateLocation = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = locationIdSchema.parse(idInput);
  const data = updateLocationSchema.parse(input);
  const current = await findLocation(id);
  await assertUnique(data.code ?? current.code, data.name ?? current.name, id);
  await db.transaction(async (transaction) => {
    await transaction.update(locations).set({ ...data, timestamp: Date.now() }).where(eq(locations.id, id));
    await transaction.insert(auditLogs).values(audit(user, context, 'update', id, current, data));
  });
  return getLocation(id);
};

export const setLocationStatus = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = locationIdSchema.parse(idInput);
  const { isActive } = updateLocationStatusSchema.parse(input);
  const current = await findLocation(id);
  if (current.isActive === isActive) return getLocation(id);
  if (!isActive) {
    const [{ openOrders }] = await db.select({ openOrders: count() }).from(purchaseOrders)
      .innerJoin(purchaseOrderStatuses, eq(purchaseOrders.status, purchaseOrderStatuses.id))
      .where(and(eq(purchaseOrders.locationId, id), eq(purchaseOrderStatuses.isFinal, false)));
    if (Number(openOrders) > 0) throw new AppError('This location has active purchase orders and cannot be deactivated.', 409);
  }
  await db.transaction(async (transaction) => {
    await transaction.update(locations).set({ isActive, timestamp: Date.now() }).where(eq(locations.id, id));
    await transaction.insert(auditLogs).values(audit(user, context, isActive ? 'activate' : 'deactivate', id, { isActive: current.isActive }, { isActive }));
  });
  return getLocation(id);
};
