import { randomBytes } from 'crypto';
import { and, count, desc, eq, like, or, type SQL } from 'drizzle-orm';

import { db } from '../../db';
import { auditLogs, customers, locations, repairHistory, repairJobs, users } from '../../db/schema';
import { AppError } from '../../errors/app-error';
import type { AuthenticatedUser } from '../auth/authService';
import { safeCreateNotification } from '../notification/notificationService';
import { USER_PERMISSIONS } from '../../utils/constants';
import { createRepairJobSchema, listRepairJobsSchema, publicRepairStatusSchema, repairJobIdSchema, updateRepairStatusSchema } from './repairValidation';

type AuditContext = { ipAddress?: string };
type RepairStatus = 'received' | 'inspection' | 'waitingParts' | 'inProgress' | 'completed' | 'delivered' | 'cancelled';

const currentYear = () => Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Colombo', year: 'numeric' }).format(new Date()));
const makePublicPath = (jobNo: string, accessToken: string) => `/dashboard/repair-status?jobNo=${encodeURIComponent(jobNo)}&token=${encodeURIComponent(accessToken)}`;
const makeToken = () => randomBytes(24).toString('base64url');
const makeJobNo = (locationId: number) => `RJ-${String(locationId).padStart(3, '0')}-${currentYear()}-${randomBytes(3).toString('hex').toUpperCase()}`;

const statusLabels: Record<RepairStatus, string> = {
  cancelled: 'Cancelled',
  completed: 'Completed',
  delivered: 'Delivered',
  inProgress: 'Repair in progress',
  inspection: 'Inspection',
  received: 'Received',
  waitingParts: 'Waiting for parts',
};

const buildTimeline = (status: RepairStatus, rows: Array<{ newStatus: string; timestamp: number }>) => {
  const order: RepairStatus[] = ['received', 'inspection', 'waitingParts', 'inProgress', 'completed', 'delivered'];
  const reached = new Set(rows.map((row) => row.newStatus));
  const statusIndex = order.indexOf(status);
  const safeIndex = statusIndex >= 0 ? statusIndex : 0;
  const timeline = order.map((value, index) => ({
    active: value === status,
    completed: reached.has(value) || index < safeIndex,
    label: statusLabels[value],
    status: value,
    timestamp: rows.find((row) => row.newStatus === value)?.timestamp ?? null,
  }));
  if (status === 'cancelled') {
    timeline.push({
      active: true,
      completed: true,
      label: statusLabels.cancelled,
      status: 'cancelled',
      timestamp: rows.find((row) => row.newStatus === 'cancelled')?.timestamp ?? null,
    });
  }
  return timeline;
};

const repairDetail = async (id: number) => {
  const [job] = await db.select({
    addedBy: repairJobs.addedBy,
    assignedTo: repairJobs.assignedTo,
    assignedToName: users.displayName,
    customerId: repairJobs.customerId,
    customerName: customers.name,
    customerPhone: customers.phone,
    deviceName: repairJobs.deviceName,
    estimatedCost: repairJobs.estimatedCost,
    finalCost: repairJobs.finalCost,
    id: repairJobs.id,
    jobNo: repairJobs.jobNo,
    locationId: repairJobs.locationId,
    locationName: locations.name,
    problemDescription: repairJobs.problemDescription,
    publicStatusToken: repairJobs.publicStatusToken,
    serialImei: repairJobs.serialImei,
    status: repairJobs.status,
    timestamp: repairJobs.timestamp,
  }).from(repairJobs)
    .innerJoin(customers, eq(customers.id, repairJobs.customerId))
    .innerJoin(locations, eq(locations.id, repairJobs.locationId))
    .leftJoin(users, eq(users.id, repairJobs.assignedTo))
    .where(eq(repairJobs.id, id)).limit(1);
  if (!job) throw new AppError('Repair job not found.', 404);
  const history = await db.select({
    id: repairHistory.id,
    newStatus: repairHistory.newStatus,
    note: repairHistory.note,
    oldStatus: repairHistory.oldStatus,
    timestamp: repairHistory.timestamp,
    userName: users.displayName,
  }).from(repairHistory)
    .innerJoin(users, eq(users.id, repairHistory.userId))
    .where(eq(repairHistory.repairJobId, id))
    .orderBy(repairHistory.timestamp);
  return { ...job, history, publicStatusPath: makePublicPath(job.jobNo, job.publicStatusToken) };
};

export const listRepairJobs = async (input: unknown) => {
  const query = listRepairJobsSchema.parse(input);
  const filters: SQL[] = [];
  if (query.status !== 'all') filters.push(eq(repairJobs.status, query.status));
  if (query.search) {
    const condition = or(
      like(repairJobs.jobNo, `%${query.search}%`),
      like(repairJobs.deviceName, `%${query.search}%`),
      like(repairJobs.serialImei, `%${query.search}%`),
      like(customers.name, `%${query.search}%`),
      like(customers.phone, `%${query.search}%`),
    );
    if (condition) filters.push(condition);
  }
  const where = filters.length ? and(...filters) : undefined;
  const offset = (query.page - 1) * query.pageSize;
  const [items, [{ total }]] = await Promise.all([
    db.select({
      customerName: customers.name,
      customerPhone: customers.phone,
      deviceName: repairJobs.deviceName,
      estimatedCost: repairJobs.estimatedCost,
      id: repairJobs.id,
      jobNo: repairJobs.jobNo,
      locationName: locations.name,
      serialImei: repairJobs.serialImei,
      status: repairJobs.status,
      timestamp: repairJobs.timestamp,
    }).from(repairJobs)
      .innerJoin(customers, eq(customers.id, repairJobs.customerId))
      .innerJoin(locations, eq(locations.id, repairJobs.locationId))
      .where(where).orderBy(desc(repairJobs.id)).limit(query.pageSize).offset(offset),
    db.select({ total: count() }).from(repairJobs).innerJoin(customers, eq(customers.id, repairJobs.customerId)).where(where),
  ]);
  return { items, pagination: { page: query.page, pageSize: query.pageSize, total: Number(total), totalPages: Math.ceil(Number(total) / query.pageSize) } };
};

export const getRepairJob = async (input: unknown) => repairDetail(repairJobIdSchema.parse(input));

export const createRepairJob = async (input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const data = createRepairJobSchema.parse(input);
  if (!user.defaultLocationId) throw new AppError('Your account does not have an assigned repair location.', 400);
  const createdId = await db.transaction(async (transaction) => {
    let customerId = data.customer.id ?? null;
    if (!customerId && data.customer.phone) {
      const [existing] = await transaction.select({ id: customers.id }).from(customers).where(eq(customers.phone, data.customer.phone)).limit(1);
      customerId = existing?.id ?? null;
    }
    if (!customerId) {
      const result = await transaction.insert(customers).values({
        isActive: true,
        name: data.customer.name!,
        phone: data.customer.phone!,
        timestamp: Date.now(),
      });
      customerId = Number(result[0].insertId);
    }
    let jobNo = makeJobNo(user.defaultLocationId!);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const [existing] = await transaction.select({ id: repairJobs.id }).from(repairJobs).where(eq(repairJobs.jobNo, jobNo)).limit(1);
      if (!existing) break;
      jobNo = makeJobNo(user.defaultLocationId!);
    }
    const timestamp = Date.now();
    const result = await transaction.insert(repairJobs).values({
      addedBy: user.id,
      assignedTo: data.assignedTo ?? null,
      customerId,
      deviceName: data.deviceName,
      estimatedCost: String(data.estimatedCost),
      finalCost: '0.00',
      jobNo,
      locationId: user.defaultLocationId!,
      problemDescription: data.problemDescription,
      publicStatusToken: makeToken(),
      serialImei: data.serialImei || null,
      status: 'received',
      timestamp,
    });
    const repairJobId = Number(result[0].insertId);
    await transaction.insert(repairHistory).values({ newStatus: 'received', note: 'Repair job received.', repairJobId, timestamp, userId: user.id });
    await transaction.insert(auditLogs).values({
      action: 'create',
      entityId: repairJobId,
      entityType: 'repair_job',
      ipAddress: context.ipAddress,
      module: 'repairs',
      newValues: { deviceName: data.deviceName, jobNo },
      timestamp,
      userId: user.id,
    });
    return repairJobId;
  });
  const detail = await repairDetail(createdId);
  await safeCreateNotification({
    entityId: detail.id,
    entityType: 'repair_job',
    locationId: detail.locationId,
    message: `${detail.jobNo} received for ${detail.customerName}. Device: ${detail.deviceName}.`,
    module: 'repairs',
    severity: 'info',
    targetPermission: USER_PERMISSIONS.REPAIRS_VIEW,
    title: 'New repair job',
  }, user.id);
  return detail;
};

export const updateRepairStatus = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = repairJobIdSchema.parse(idInput);
  const data = updateRepairStatusSchema.parse(input);
  const [job] = await db.select({ id: repairJobs.id, status: repairJobs.status }).from(repairJobs).where(eq(repairJobs.id, id)).limit(1);
  if (!job) throw new AppError('Repair job not found.', 404);
  if (job.status === data.status) return repairDetail(id);
  await db.transaction(async (transaction) => {
    const timestamp = Date.now();
    await transaction.update(repairJobs).set({ status: data.status }).where(eq(repairJobs.id, id));
    await transaction.insert(repairHistory).values({ newStatus: data.status, note: data.note || null, oldStatus: job.status, repairJobId: id, timestamp, userId: user.id });
    await transaction.insert(auditLogs).values({
      action: 'update',
      entityId: id,
      entityType: 'repair_job',
      ipAddress: context.ipAddress,
      module: 'repairs',
      newValues: { status: data.status },
      oldValues: { status: job.status },
      timestamp,
      userId: user.id,
    });
  });
  const detail = await repairDetail(id);
  await safeCreateNotification({
    entityId: detail.id,
    entityType: 'repair_job',
    locationId: detail.locationId,
    message: `${detail.jobNo} moved from ${statusLabels[job.status as RepairStatus] ?? job.status} to ${statusLabels[detail.status as RepairStatus] ?? detail.status}.`,
    module: 'repairs',
    severity: data.status === 'completed' ? 'success' : data.status === 'cancelled' ? 'warning' : 'info',
    targetPermission: USER_PERMISSIONS.REPAIRS_VIEW,
    title: 'Repair status updated',
  }, user.id);
  return detail;
};

export const publicRepairStatus = async (input: unknown) => {
  const query = publicRepairStatusSchema.parse(input);
  const [job] = await db.select({
    deviceName: repairJobs.deviceName,
    estimatedCost: repairJobs.estimatedCost,
    jobNo: repairJobs.jobNo,
    locationName: locations.name,
    serialImei: repairJobs.serialImei,
    status: repairJobs.status,
    timestamp: repairJobs.timestamp,
  }).from(repairJobs)
    .innerJoin(locations, eq(locations.id, repairJobs.locationId))
    .where(and(eq(repairJobs.jobNo, query.jobNo), eq(repairJobs.publicStatusToken, query.token)))
    .limit(1);
  if (!job) throw new AppError('Repair job was not found or the access code is invalid.', 404);
  const history = await db.select({
    newStatus: repairHistory.newStatus,
    timestamp: repairHistory.timestamp,
  }).from(repairHistory)
    .innerJoin(repairJobs, eq(repairJobs.id, repairHistory.repairJobId))
    .where(and(eq(repairJobs.jobNo, query.jobNo), eq(repairJobs.publicStatusToken, query.token)))
    .orderBy(repairHistory.timestamp);
  return {
    ...job,
    statusLabel: statusLabels[job.status],
    timeline: buildTimeline(job.status, history),
  };
};
