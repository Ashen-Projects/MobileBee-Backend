import { and, asc, count, eq, inArray, like, ne, or, sql, type SQL } from 'drizzle-orm';

import { db } from '../../db';
import { auditLogs, customers, locations, products, repairJobs, saleItems, sales } from '../../db/schema';
import { AppError } from '../../errors/app-error';
import type { AuthenticatedUser } from '../auth/authService';
import { createCustomerSchema, customerIdSchema, listCustomersSchema, updateCustomerSchema, updateCustomerStatusSchema } from './customerValidation';

type AuditContext = { ipAddress?: string };

const cleanText = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const audit = (user: AuthenticatedUser, context: AuditContext, action: string, entityId: number, oldValues?: unknown, newValues?: unknown) => ({
  action,
  entityId,
  entityType: 'customer',
  ipAddress: context.ipAddress,
  module: 'customers',
  newValues,
  oldValues,
  timestamp: Date.now(),
  userId: user.id,
});

const assertUniquePhone = async (phone: string, excludedId?: number) => {
  const [duplicate] = await db.select({ id: customers.id }).from(customers)
    .where(excludedId ? and(ne(customers.id, excludedId), eq(customers.phone, phone)) : eq(customers.phone, phone))
    .limit(1);
  if (duplicate) throw new AppError('A customer with this phone number already exists.', 409);
};

const getCustomerRow = async (id: number) => {
  const [customer] = await db.select({
    address: customers.address,
    email: customers.email,
    id: customers.id,
    isActive: customers.isActive,
    name: customers.name,
    nic: customers.nic,
    phone: customers.phone,
    timestamp: customers.timestamp,
  }).from(customers).where(eq(customers.id, id)).limit(1);
  if (!customer) throw new AppError('Customer not found.', 404);
  const [[{ total: repairCount }], [{ total: saleCount }]] = await Promise.all([
    db.select({ total: count() }).from(repairJobs).where(eq(repairJobs.customerId, id)),
    db.select({ total: count() }).from(sales).where(eq(sales.customerId, id)),
  ]);
  return { ...customer, repairCount: Number(repairCount), saleCount: Number(saleCount) };
};

const attachCustomerCounts = async <T extends { id: number }>(items: T[]) => {
  if (!items.length) return items.map((item) => ({ ...item, repairCount: 0, saleCount: 0 }));
  const ids = items.map(({ id }) => id);
  const [repairCounts, saleCounts] = await Promise.all([
    db.select({ customerId: repairJobs.customerId, total: count() })
      .from(repairJobs)
      .where(inArray(repairJobs.customerId, ids))
      .groupBy(repairJobs.customerId),
    db.select({ customerId: sales.customerId, total: count() })
      .from(sales)
      .where(inArray(sales.customerId, ids))
      .groupBy(sales.customerId),
  ]);
  const repairsByCustomer = new Map(repairCounts.map((row) => [row.customerId, Number(row.total)]));
  const salesByCustomer = new Map(saleCounts.map((row) => [row.customerId, Number(row.total)]));
  return items.map((item) => ({
    ...item,
    repairCount: repairsByCustomer.get(item.id) ?? 0,
    saleCount: salesByCustomer.get(item.id) ?? 0,
  }));
};

const customerActivity = async (id: number) => {
  const [saleRows, repairRows] = await Promise.all([
    db.select({
      discountAmount: sales.discountAmount,
      id: sales.id,
      invoiceNo: sales.invoiceNo,
      itemSummary: sql<string>`coalesce(group_concat(concat(${products.name}, ' x', ${saleItems.quantity}) order by ${saleItems.id} separator ', '), '')`,
      locationName: locations.name,
      paidAmount: sales.paidAmount,
      status: sales.status,
      timestamp: sales.timestamp,
      totalAmount: sales.totalAmount,
    }).from(sales)
      .innerJoin(locations, eq(locations.id, sales.locationId))
      .leftJoin(saleItems, eq(saleItems.saleId, sales.id))
      .leftJoin(products, eq(products.id, saleItems.productId))
      .where(eq(sales.customerId, id))
      .groupBy(sales.id, sales.invoiceNo, sales.timestamp, locations.name, sales.totalAmount, sales.paidAmount, sales.discountAmount, sales.status)
      .orderBy(sql`${sales.timestamp} desc`)
      .limit(25),
    db.select({
      deviceName: repairJobs.deviceName,
      estimatedCost: repairJobs.estimatedCost,
      finalCost: repairJobs.finalCost,
      id: repairJobs.id,
      jobNo: repairJobs.jobNo,
      locationName: locations.name,
      serialImei: repairJobs.serialImei,
      status: repairJobs.status,
      timestamp: repairJobs.timestamp,
    }).from(repairJobs)
      .innerJoin(locations, eq(locations.id, repairJobs.locationId))
      .where(eq(repairJobs.customerId, id))
      .orderBy(sql`${repairJobs.timestamp} desc`)
      .limit(25),
  ]);
  return { repairs: repairRows, sales: saleRows };
};

export const listCustomers = async (input: unknown) => {
  const query = listCustomersSchema.parse(input);
  const filters: SQL[] = [];
  if (query.isActive !== 'all') filters.push(eq(customers.isActive, query.isActive === 'true'));
  if (query.search) {
    const condition = or(
      like(customers.name, `%${query.search}%`),
      like(customers.phone, `%${query.search}%`),
      like(customers.email, `%${query.search}%`),
      like(customers.nic, `%${query.search}%`),
    );
    if (condition) filters.push(condition);
  }
  const where = filters.length ? and(...filters) : undefined;
  const offset = (query.page - 1) * query.pageSize;
  const [items, [{ total }]] = await Promise.all([
    db.select({
      address: customers.address,
      email: customers.email,
      id: customers.id,
      isActive: customers.isActive,
      name: customers.name,
      nic: customers.nic,
      phone: customers.phone,
      timestamp: customers.timestamp,
    }).from(customers).where(where).orderBy(asc(customers.name)).limit(query.pageSize).offset(offset),
    db.select({ total: count() }).from(customers).where(where),
  ]);
  const itemsWithCounts = await attachCustomerCounts(items);
  return {
    items: itemsWithCounts,
    pagination: { page: query.page, pageSize: query.pageSize, total: Number(total), totalPages: Math.ceil(Number(total) / query.pageSize) },
  };
};

export const getCustomer = async (input: unknown) => {
  const id = customerIdSchema.parse(input);
  const [customer, activity] = await Promise.all([getCustomerRow(id), customerActivity(id)]);
  return { ...customer, ...activity };
};

export const createCustomer = async (input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const data = createCustomerSchema.parse(input);
  await assertUniquePhone(data.phone);
  const result = await db.insert(customers).values({
    address: cleanText(data.address),
    email: cleanText(data.email),
    isActive: true,
    name: data.name,
    nic: cleanText(data.nic),
    phone: data.phone,
    timestamp: Date.now(),
  });
  const id = Number(result[0].insertId);
  await db.insert(auditLogs).values(audit(user, context, 'create', id, undefined, data));
  return getCustomerRow(id);
};

export const updateCustomer = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = customerIdSchema.parse(idInput);
  const data = updateCustomerSchema.parse(input);
  const current = await getCustomerRow(id);
  if (data.phone && data.phone !== current.phone) await assertUniquePhone(data.phone, id);
  const next = {
    ...(data.address !== undefined ? { address: cleanText(data.address) } : {}),
    ...(data.email !== undefined ? { email: cleanText(data.email) } : {}),
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.nic !== undefined ? { nic: cleanText(data.nic) } : {}),
    ...(data.phone !== undefined ? { phone: data.phone } : {}),
  };
  await db.update(customers).set(next).where(eq(customers.id, id));
  await db.insert(auditLogs).values(audit(user, context, 'update', id, current, next));
  return getCustomerRow(id);
};

export const updateCustomerStatus = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = customerIdSchema.parse(idInput);
  const data = updateCustomerStatusSchema.parse(input);
  const current = await getCustomerRow(id);
  await db.update(customers).set({ isActive: data.isActive }).where(eq(customers.id, id));
  await db.insert(auditLogs).values(audit(user, context, data.isActive ? 'activate' : 'deactivate', id, { isActive: current.isActive }, data));
  return getCustomerRow(id);
};
