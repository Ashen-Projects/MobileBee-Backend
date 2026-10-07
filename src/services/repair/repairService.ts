import { randomBytes } from 'crypto';
import { and, count, desc, eq, inArray, like, or, sql, type SQL } from 'drizzle-orm';

import { db } from '../../db';
import { auditLogs, customers, locations, posDrawers, products, repairDocuments, repairHistory, repairJobs, repairParts, repairPayments, stock, stockLogs, stockStatuses, users } from '../../db/schema';
import { AppError } from '../../errors/app-error';
import type { AuthenticatedUser } from '../auth/authService';
import { safeCreateNotification } from '../notification/notificationService';
import { USER_PERMISSIONS } from '../../utils/constants';
import { repairImageUrl } from '../media/cloudinaryService';
import { addRepairPartSchema, createRepairJobSchema, listRepairJobsSchema, publicRepairStatusSchema, recordRepairPaymentSchema, repairJobIdSchema, repairPartIdSchema, updateRepairChargeSchema, updateRepairStatusSchema } from './repairValidation';

type AuditContext = { ipAddress?: string };
type RepairStatus = 'received' | 'inspection' | 'waitingParts' | 'inProgress' | 'completed' | 'delivered' | 'cancelled';
type RepairPartStatus = 'reserved' | 'consumed' | 'released';
type RepairImage = { cloudinaryPublicId: string; fileName: string };
type RepairPaymentMethod = 'cash' | 'card' | 'bankTransfer' | 'mobile';
type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const money = (value: number) => Number(value.toFixed(2));
const terminalRepairStatuses = new Set<RepairStatus>(['cancelled', 'completed', 'delivered']);

const currentYear = () => Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Colombo', year: 'numeric' }).format(new Date()));
const makePublicPath = (jobNo: string, accessToken: string) => `/dashboard/repair-status?jobNo=${encodeURIComponent(jobNo)}&token=${encodeURIComponent(accessToken)}`;
const makeToken = () => randomBytes(24).toString('base64url');
const makeJobNo = (locationId: number) => `RJ-${String(locationId).padStart(3, '0')}-${currentYear()}-${randomBytes(3).toString('hex').toUpperCase()}`;

const repairImageDocuments = (
  images: RepairImage[],
  documentType: 'intakePhoto' | 'inspectionPhoto',
  repairJobId: number,
  uploadedBy: number,
  timestamp: number,
) => images.map((image) => ({
  cloudinaryPublicId: image.cloudinaryPublicId,
  documentType,
  fileName: image.fileName,
  fileUrl: repairImageUrl(image.cloudinaryPublicId),
  repairJobId,
  timestamp,
  uploadedBy,
}));

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
  const [history, documents, payments, parts] = await Promise.all([
    db.select({
      id: repairHistory.id,
      newStatus: repairHistory.newStatus,
      note: repairHistory.note,
      oldStatus: repairHistory.oldStatus,
      timestamp: repairHistory.timestamp,
      userName: users.displayName,
    }).from(repairHistory)
      .innerJoin(users, eq(users.id, repairHistory.userId))
      .where(eq(repairHistory.repairJobId, id))
      .orderBy(repairHistory.timestamp),
    db.select({
      documentType: repairDocuments.documentType,
      fileName: repairDocuments.fileName,
      fileUrl: repairDocuments.fileUrl,
      id: repairDocuments.id,
      timestamp: repairDocuments.timestamp,
    }).from(repairDocuments)
      .where(eq(repairDocuments.repairJobId, id))
      .orderBy(desc(repairDocuments.id)),
    db.select({
      amount: repairPayments.amount,
      drawerId: repairPayments.drawerId,
      id: repairPayments.id,
      method: repairPayments.method,
      receivedBy: repairPayments.receivedBy,
      receivedByName: users.displayName,
      referenceNo: repairPayments.referenceNo,
      timestamp: repairPayments.timestamp,
    }).from(repairPayments)
      .innerJoin(users, eq(users.id, repairPayments.receivedBy))
      .where(eq(repairPayments.repairJobId, id))
      .orderBy(repairPayments.id),
    db.select({
      barcode: stock.barcode,
      consumedAt: repairParts.consumedAt,
      description: repairParts.description,
      id: repairParts.id,
      productId: repairParts.productId,
      productName: products.name,
      releasedAt: repairParts.releasedAt,
      status: repairParts.status,
      stockId: repairParts.stockId,
      timestamp: repairParts.timestamp,
    }).from(repairParts)
      .leftJoin(stock, eq(stock.id, repairParts.stockId))
      .leftJoin(products, eq(products.id, repairParts.productId))
      .where(eq(repairParts.repairJobId, id))
      .orderBy(desc(repairParts.id)),
  ]);
  const totalPaid = money(payments.reduce((total, payment) => total + Number(payment.amount), 0));
  const balance = money(Math.max(0, Number(job.finalCost) - totalPaid));
  const paymentStatus = balance === 0 ? 'paid' : totalPaid > 0 ? 'partiallyPaid' : 'unpaid';
  return { ...job, balance, documents, history, parts, paymentStatus, payments, publicStatusPath: makePublicPath(job.jobNo, job.publicStatusToken), totalPaid };
};

const getStockStatusId = async (transaction: DatabaseTransaction, name: string) => {
  const [status] = await transaction.select({ id: stockStatuses.id }).from(stockStatuses).where(eq(stockStatuses.name, name)).limit(1);
  if (!status) throw new AppError(`Stock status '${name}' is not configured. Restart the API once after deploying this update.`, 500);
  return status.id;
};

const releaseReservedRepairParts = async (
  transaction: DatabaseTransaction,
  repairJobId: number,
  locationId: number,
  userId: number,
  timestamp: number,
  note: string,
  partIds?: number[],
) => {
  const [availableStatusId, repairReservedStatusId] = await Promise.all([
    getStockStatusId(transaction, 'available'),
    getStockStatusId(transaction, 'repair_reserved'),
  ]);
  const parts = await transaction.select({ id: repairParts.id, stockId: repairParts.stockId, stockLocationId: stock.locationId, stockStatus: stock.status })
    .from(repairParts)
    .innerJoin(stock, eq(stock.id, repairParts.stockId))
    .where(and(
      eq(repairParts.repairJobId, repairJobId),
      eq(repairParts.status, 'reserved'),
      ...(partIds?.length ? [inArray(repairParts.id, partIds)] : []),
    ))
    .for('update');
  if (!parts.length) return;
  if (parts.some((part) => part.stockLocationId !== locationId || part.stockStatus !== repairReservedStatusId)) {
    throw new AppError('A reserved spare part is no longer in the expected stock state. Refresh the repair job before continuing.', 409);
  }
  const stockIds = parts.map((part) => part.stockId).filter((value): value is number => value !== null).sort((left, right) => left - right);
  if (!stockIds.length) return;
  await transaction.update(repairParts).set({ releasedAt: timestamp, status: 'released' })
    .where(inArray(repairParts.id, parts.map((part) => part.id)));
  await transaction.update(stock).set({ status: availableStatusId }).where(inArray(stock.id, stockIds));
  await transaction.insert(stockLogs).values(parts.map((part) => ({
    action: 'repair_part_released',
    newLocationId: locationId,
    newStatus: availableStatusId,
    note,
    previousLocationId: locationId,
    previousStatus: repairReservedStatusId,
    referenceId: repairJobId,
    referenceType: 'repair_job',
    stockId: part.stockId!,
    timestamp,
    userId,
  })));
};

const consumeReservedRepairParts = async (
  transaction: DatabaseTransaction,
  repairJobId: number,
  locationId: number,
  userId: number,
  timestamp: number,
) => {
  const [repairConsumedStatusId, repairReservedStatusId] = await Promise.all([
    getStockStatusId(transaction, 'repair_consumed'),
    getStockStatusId(transaction, 'repair_reserved'),
  ]);
  const parts = await transaction.select({ id: repairParts.id, stockId: repairParts.stockId, stockLocationId: stock.locationId, stockStatus: stock.status })
    .from(repairParts)
    .innerJoin(stock, eq(stock.id, repairParts.stockId))
    .where(and(eq(repairParts.repairJobId, repairJobId), eq(repairParts.status, 'reserved')))
    .for('update');
  if (!parts.length) return;
  if (parts.some((part) => part.stockLocationId !== locationId || part.stockStatus !== repairReservedStatusId)) {
    throw new AppError('A reserved spare part is no longer in the expected stock state. Refresh the repair job before completing it.', 409);
  }
  const stockIds = parts.map((part) => part.stockId).filter((value): value is number => value !== null).sort((left, right) => left - right);
  if (!stockIds.length) return;
  await transaction.update(repairParts).set({ consumedAt: timestamp, status: 'consumed' })
    .where(inArray(repairParts.id, parts.map((part) => part.id)));
  await transaction.update(stock).set({ status: repairConsumedStatusId }).where(inArray(stock.id, stockIds));
  await transaction.insert(stockLogs).values(parts.map((part) => ({
    action: 'repair_part_consumed',
    newLocationId: locationId,
    newStatus: repairConsumedStatusId,
    note: 'Consumed when the repair was completed.',
    previousLocationId: locationId,
    previousStatus: repairReservedStatusId,
    referenceId: repairJobId,
    referenceType: 'repair_job',
    stockId: part.stockId!,
    timestamp,
    userId,
  })));
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
    if (data.intakePhotos.length) {
      await transaction.insert(repairDocuments).values(repairImageDocuments(data.intakePhotos, 'intakePhoto', repairJobId, user.id, timestamp));
    }
    await transaction.insert(auditLogs).values({
      action: 'create',
      entityId: repairJobId,
      entityType: 'repair_job',
      ipAddress: context.ipAddress,
      module: 'repairs',
      newValues: { deviceName: data.deviceName, intakePhotoCount: data.intakePhotos.length, jobNo },
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

export const updateRepairCharge = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = repairJobIdSchema.parse(idInput);
  const data = updateRepairChargeSchema.parse(input);
  await db.transaction(async (transaction) => {
    const [job] = await transaction.select({ finalCost: repairJobs.finalCost, status: repairJobs.status })
      .from(repairJobs).where(eq(repairJobs.id, id)).limit(1).for('update');
    if (!job) throw new AppError('Repair job not found.', 404);
    if (job.status === 'cancelled' || job.status === 'delivered') {
      throw new AppError('The final charge cannot be changed after a repair is cancelled or delivered.', 409);
    }
    const [{ totalPaid }] = await transaction.select({ totalPaid: sql<string>`coalesce(sum(${repairPayments.amount}), 0)` })
      .from(repairPayments).where(eq(repairPayments.repairJobId, id));
    if (data.finalCost < Number(totalPaid)) {
      throw new AppError('The final charge cannot be lower than payments already received.', 409);
    }
    const timestamp = Date.now();
    await transaction.update(repairJobs).set({ finalCost: String(money(data.finalCost)) }).where(eq(repairJobs.id, id));
    await transaction.insert(auditLogs).values({
      action: 'update',
      entityId: id,
      entityType: 'repair_job',
      ipAddress: context.ipAddress,
      module: 'repairs',
      newValues: { finalCost: money(data.finalCost) },
      oldValues: { finalCost: Number(job.finalCost) },
      timestamp,
      userId: user.id,
    });
  });
  return repairDetail(id);
};

export const addRepairPart = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = repairJobIdSchema.parse(idInput);
  const data = addRepairPartSchema.parse(input);
  if (!user.defaultLocationId) throw new AppError('Your account does not have an assigned repair location.', 400);

  await db.transaction(async (transaction) => {
    const [job] = await transaction.select({ jobNo: repairJobs.jobNo, locationId: repairJobs.locationId, status: repairJobs.status })
      .from(repairJobs).where(eq(repairJobs.id, id)).limit(1).for('update');
    if (!job) throw new AppError('Repair job not found.', 404);
    if (job.locationId !== user.defaultLocationId) throw new AppError('You can only use stock at your assigned repair location.', 403);
    if (terminalRepairStatuses.has(job.status as RepairStatus)) {
      throw new AppError('Parts can only be added before the repair is completed, delivered, or cancelled.', 409);
    }

    const [availableStatusId, repairReservedStatusId] = await Promise.all([
      getStockStatusId(transaction, 'available'),
      getStockStatusId(transaction, 'repair_reserved'),
    ]);
    const [unit] = await transaction.select({
      barcode: stock.barcode,
      costPrice: stock.costPrice,
      locationId: stock.locationId,
      productId: stock.productId,
      productName: products.name,
      status: stock.status,
      stockId: stock.id,
    }).from(stock)
      .leftJoin(products, eq(products.id, stock.productId))
      .where(eq(stock.barcode, data.barcode)).limit(1).for('update');
    if (!unit) throw new AppError('No stock unit was found for this barcode.', 404);
    if (unit.locationId !== user.defaultLocationId) throw new AppError('This spare part belongs to a different location.', 409);
    if (unit.status !== availableStatusId) throw new AppError('This spare part is not available. It may already be reserved, sold, or written off.', 409);

    const [existing] = await transaction.select({ id: repairParts.id, status: repairParts.status })
      .from(repairParts)
      .where(and(eq(repairParts.repairJobId, id), eq(repairParts.stockId, unit.stockId)))
      .limit(1).for('update');
    if (existing?.status === 'reserved') throw new AppError('This spare part is already reserved for this repair.', 409);
    if (existing?.status === 'consumed') throw new AppError('This spare part was already consumed by this repair and cannot be added again.', 409);

    const timestamp = Date.now();
    const description = unit.productName || `Stock unit ${unit.barcode || unit.stockId}`;
    if (existing) {
      await transaction.update(repairParts).set({
        consumedAt: null,
        description,
        productId: unit.productId,
        releasedAt: null,
        status: 'reserved',
        timestamp,
        unitPrice: unit.costPrice,
      }).where(eq(repairParts.id, existing.id));
    } else {
      await transaction.insert(repairParts).values({
        description,
        productId: unit.productId,
        quantity: 1,
        repairJobId: id,
        status: 'reserved',
        stockId: unit.stockId,
        timestamp,
        unitPrice: unit.costPrice,
      });
    }
    await transaction.update(stock).set({ status: repairReservedStatusId }).where(eq(stock.id, unit.stockId));
    await transaction.insert(stockLogs).values({
      action: 'repair_part_reserved',
      newLocationId: job.locationId,
      newStatus: repairReservedStatusId,
      note: `Reserved as a spare part for ${job.jobNo}.`,
      previousLocationId: job.locationId,
      previousStatus: availableStatusId,
      referenceId: id,
      referenceType: 'repair_job',
      stockId: unit.stockId,
      timestamp,
      userId: user.id,
    });
    await transaction.insert(auditLogs).values({
      action: 'repair_part_reserved',
      entityId: id,
      entityType: 'repair_job',
      ipAddress: context.ipAddress,
      module: 'repairs',
      newValues: { barcode: unit.barcode, productId: unit.productId, stockId: unit.stockId },
      timestamp,
      userId: user.id,
    });
  });
  return repairDetail(id);
};

export const releaseRepairPart = async (idInput: unknown, partIdInput: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = repairJobIdSchema.parse(idInput);
  const partId = repairPartIdSchema.parse(partIdInput);
  if (!user.defaultLocationId) throw new AppError('Your account does not have an assigned repair location.', 400);

  await db.transaction(async (transaction) => {
    const [job] = await transaction.select({ jobNo: repairJobs.jobNo, locationId: repairJobs.locationId, status: repairJobs.status })
      .from(repairJobs).where(eq(repairJobs.id, id)).limit(1).for('update');
    if (!job) throw new AppError('Repair job not found.', 404);
    if (job.locationId !== user.defaultLocationId) throw new AppError('You can only release stock at your assigned repair location.', 403);
    if (terminalRepairStatuses.has(job.status as RepairStatus)) {
      throw new AppError('Parts cannot be released after the repair is completed, delivered, or cancelled.', 409);
    }
    const repairReservedStatusId = await getStockStatusId(transaction, 'repair_reserved');
    const [part] = await transaction.select({ id: repairParts.id, stockId: repairParts.stockId, status: repairParts.status })
      .from(repairParts).where(and(eq(repairParts.id, partId), eq(repairParts.repairJobId, id))).limit(1).for('update');
    if (!part) throw new AppError('Repair spare part not found.', 404);
    if (part.status !== 'reserved' || !part.stockId) throw new AppError('Only currently reserved spare parts can be released.', 409);
    const [unit] = await transaction.select({ locationId: stock.locationId, status: stock.status }).from(stock)
      .where(eq(stock.id, part.stockId)).limit(1).for('update');
    if (!unit || unit.locationId !== job.locationId || unit.status !== repairReservedStatusId) {
      throw new AppError('This spare part is no longer reserved for this repair. Refresh the repair job before continuing.', 409);
    }
    const timestamp = Date.now();
    await releaseReservedRepairParts(transaction, id, job.locationId, user.id, timestamp, `Released from ${job.jobNo}; not used in the repair.`, [partId]);
    await transaction.insert(auditLogs).values({
      action: 'repair_part_released',
      entityId: id,
      entityType: 'repair_job',
      ipAddress: context.ipAddress,
      module: 'repairs',
      newValues: { partId, stockId: part.stockId },
      timestamp,
      userId: user.id,
    });
  });
  return repairDetail(id);
};

export const collectRepairPayment = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = repairJobIdSchema.parse(idInput);
  const data = recordRepairPaymentSchema.parse(input);
  if (!user.defaultLocationId) throw new AppError('Your account does not have an assigned POS location.', 400);
  const paymentId = await db.transaction(async (transaction) => {
    const [job] = await transaction.select({ finalCost: repairJobs.finalCost, jobNo: repairJobs.jobNo, locationId: repairJobs.locationId, status: repairJobs.status })
      .from(repairJobs).where(eq(repairJobs.id, id)).limit(1).for('update');
    if (!job) throw new AppError('Repair job not found.', 404);
    if (job.locationId !== user.defaultLocationId) throw new AppError('You can only collect payment for repairs at your assigned location.', 403);
    if (job.status !== 'completed') throw new AppError('Mark the repair as completed before collecting payment.', 409);
    const finalCost = money(Number(job.finalCost));
    if (finalCost <= 0) throw new AppError('Set the final repair charge before collecting payment.', 409);

    const [drawer] = await transaction.select({ id: posDrawers.id })
      .from(posDrawers)
      .where(and(eq(posDrawers.locationId, user.defaultLocationId), eq(posDrawers.status, 'open')))
      .orderBy(desc(posDrawers.openedAt))
      .limit(1)
      .for('update');
    if (!drawer) throw new AppError('Open the POS drawer for this location before collecting a repair payment.', 409);

    const [{ totalPaid }] = await transaction.select({ totalPaid: sql<string>`coalesce(sum(${repairPayments.amount}), 0)` })
      .from(repairPayments).where(eq(repairPayments.repairJobId, id));
    const balance = money(Math.max(0, finalCost - Number(totalPaid)));
    const received = money(data.amount);
    if (received > balance) throw new AppError(`Payment cannot exceed the remaining balance of LKR ${balance.toLocaleString('en-LK', { minimumFractionDigits: 2 })}.`, 409);

    const timestamp = Date.now();
    const result = await transaction.insert(repairPayments).values({
      amount: String(received),
      drawerId: drawer.id,
      method: data.method as RepairPaymentMethod,
      receivedBy: user.id,
      referenceNo: data.referenceNo || null,
      repairJobId: id,
      timestamp,
    });
    const insertedId = Number(result[0].insertId);
    await transaction.insert(auditLogs).values({
      action: 'create',
      entityId: insertedId,
      entityType: 'repair_payment',
      ipAddress: context.ipAddress,
      module: 'repairs',
      newValues: { amount: received, drawerId: drawer.id, method: data.method, referenceNo: data.referenceNo || null, repairJobId: id },
      timestamp,
      userId: user.id,
    });
    return insertedId;
  });
  const detail = await repairDetail(id);
  const payment = detail.payments.find((value) => value.id === paymentId);
  if (!payment) throw new AppError('Repair payment was recorded but could not be loaded.', 500);
  await safeCreateNotification({
    entityId: id,
    entityType: 'repair_payment',
    locationId: detail.locationId,
    message: `${detail.jobNo}: ${payment.method} payment of LKR ${Number(payment.amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })} received. Remaining balance: LKR ${detail.balance.toLocaleString('en-LK', { minimumFractionDigits: 2 })}.`,
    module: 'repairs',
    severity: detail.balance === 0 ? 'success' : 'info',
    targetPermission: USER_PERMISSIONS.REPAIRS_VIEW,
    title: detail.balance === 0 ? 'Repair payment completed' : 'Repair payment received',
  }, user.id);
  return { detail, payment };
};

export const updateRepairStatus = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = repairJobIdSchema.parse(idInput);
  const data = updateRepairStatusSchema.parse(input);
  const [job] = await db.select({ id: repairJobs.id, status: repairJobs.status }).from(repairJobs).where(eq(repairJobs.id, id)).limit(1);
  if (!job) throw new AppError('Repair job not found.', 404);
  if (job.status === data.status) return repairDetail(id);
  let previousStatus = job.status as RepairStatus;
  await db.transaction(async (transaction) => {
    const [lockedJob] = await transaction.select({ finalCost: repairJobs.finalCost, locationId: repairJobs.locationId, status: repairJobs.status })
      .from(repairJobs).where(eq(repairJobs.id, id)).limit(1).for('update');
    if (!lockedJob) throw new AppError('Repair job not found.', 404);
    previousStatus = lockedJob.status as RepairStatus;
    if (lockedJob.status === 'delivered' || lockedJob.status === 'cancelled') {
      throw new AppError('A delivered or cancelled repair cannot be changed.', 409);
    }
    if (lockedJob.status === 'completed' && data.status !== 'delivered') {
      throw new AppError('A completed repair can only move to Delivered. Its reserved parts have already been consumed.', 409);
    }
    if (data.status === 'delivered') {
      if (lockedJob.status !== 'completed') throw new AppError('A repair must be completed before it can be delivered.', 409);
      const [{ totalPaid }] = await transaction.select({ totalPaid: sql<string>`coalesce(sum(${repairPayments.amount}), 0)` })
        .from(repairPayments).where(eq(repairPayments.repairJobId, id));
      if (money(Number(totalPaid)) < money(Number(lockedJob.finalCost))) {
        throw new AppError('Collect the remaining repair balance before delivering the device.', 409);
      }
    }
    const timestamp = Date.now();
    if (data.status === 'completed') {
      await consumeReservedRepairParts(transaction, id, lockedJob.locationId, user.id, timestamp);
    }
    if (data.status === 'cancelled') {
      await releaseReservedRepairParts(transaction, id, lockedJob.locationId, user.id, timestamp, 'Released because the repair job was cancelled.');
    }
    await transaction.update(repairJobs).set({ status: data.status }).where(eq(repairJobs.id, id));
    await transaction.insert(repairHistory).values({ newStatus: data.status, note: data.note || null, oldStatus: lockedJob.status, repairJobId: id, timestamp, userId: user.id });
    if (data.status === 'inspection') {
      await transaction.insert(repairDocuments).values(repairImageDocuments(data.inspectionPhotos, 'inspectionPhoto', id, user.id, timestamp));
    }
    await transaction.insert(auditLogs).values({
      action: 'update',
      entityId: id,
      entityType: 'repair_job',
      ipAddress: context.ipAddress,
      module: 'repairs',
      newValues: { inspectionPhotoCount: data.inspectionPhotos.length, status: data.status },
      oldValues: { status: lockedJob.status },
      timestamp,
      userId: user.id,
    });
  });
  const detail = await repairDetail(id);
  await safeCreateNotification({
    entityId: detail.id,
    entityType: 'repair_job',
    locationId: detail.locationId,
    message: `${detail.jobNo} moved from ${statusLabels[previousStatus] ?? previousStatus} to ${statusLabels[detail.status as RepairStatus] ?? detail.status}.`,
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
    id: repairJobs.id,
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
  const { id: repairJobId, ...publicJob } = job;
  const [history, inspectionPhotos] = await Promise.all([
    db.select({
      newStatus: repairHistory.newStatus,
      timestamp: repairHistory.timestamp,
    }).from(repairHistory)
      .where(eq(repairHistory.repairJobId, repairJobId))
      .orderBy(repairHistory.timestamp),
    db.select({
      fileUrl: repairDocuments.fileUrl,
      timestamp: repairDocuments.timestamp,
    }).from(repairDocuments)
      .where(and(eq(repairDocuments.repairJobId, repairJobId), eq(repairDocuments.documentType, 'inspectionPhoto')))
      .orderBy(repairDocuments.timestamp),
  ]);
  return {
    ...publicJob,
    inspectionPhotos,
    statusLabel: statusLabels[publicJob.status],
    timeline: buildTimeline(publicJob.status, history),
  };
};
