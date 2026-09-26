import { and, count, desc, eq, gte, inArray, like, lte, or, sql, type SQL } from 'drizzle-orm';

import { db } from '../../../db';
import {
  auditLogs,
  documentSequences,
  locations,
  products,
  stock,
  stockAdjustmentItems,
  stockAdjustments,
  stockIdentifiers,
  stockLogs,
  stockStatuses,
  users,
} from '../../../db/schema';
import { AppError } from '../../../errors/app-error';
import { DOCUMENT_TYPES, STOCK_STATUS, TIME_ZONE, USER_ROLES } from '../../../utils/constants';
import type { AuthenticatedUser } from '../../auth/authService';
import { safeCreateAdministratorNotifications } from '../../notification/notificationService';
import {
  createStockDamageSchema,
  declineStockDamageSchema,
  listStockDamageSchema,
  scanStockDamageSchema,
  stockDamageEntityIdSchema,
  stockDamageReasonLabels,
  type StockDamageReason,
} from './stockDamageValidation';

type AuditContext = { ipAddress?: string };

const currentYear = () => Number(new Intl.DateTimeFormat('en', {
  timeZone: TIME_ZONE,
  year: 'numeric',
}).format(new Date()));

const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const dateStart = (value: string) => Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10))) - COLOMBO_OFFSET_MS;
const dateEnd = (value: string) => dateStart(value) + 86_399_999;
const money = (value: number) => (Math.round(value * 100) / 100).toFixed(2);
const isAdministrator = (user: AuthenticatedUser) => user.roles.some(({ name }) => name === USER_ROLES.ADMIN);

const assignedLocationId = (user: AuthenticatedUser) => {
  if (!user.defaultLocationId) throw new AppError('Your account does not have an assigned location. Ask an administrator to assign one before recording damaged stock.', 403);
  return user.defaultLocationId;
};

const audit = (user: AuthenticatedUser, context: AuditContext, values: {
  action: string;
  entityId: number;
  newValues?: unknown;
}) => ({
  ...values,
  entityType: 'stock_adjustment',
  ipAddress: context.ipAddress,
  module: 'stock',
  timestamp: Date.now(),
  userId: user.id,
});

// A stock unit always remains in inventory history. Damaging it changes its status,
// which removes it from every sellable-stock query while retaining traceability.
export const scanStockForDamage = async (input: unknown, user: AuthenticatedUser) => {
  const { code } = scanStockDamageSchema.parse(input);
  const locationId = assignedLocationId(user);
  const barcodeRows = await db.select({
    barcode: stock.barcode,
    costPrice: stock.costPrice,
    identifierType: sql<string | null>`'barcode'`,
    identifierValue: stock.barcode,
    locationId: stock.locationId,
    locationName: locations.name,
    productId: stock.productId,
    productMrpPrice: products.mrpPrice,
    productName: products.name,
    productSku: products.sku,
    statusId: stock.status,
    statusLabel: stockStatuses.label,
    statusName: stockStatuses.name,
    stockId: stock.id,
  }).from(stock)
    .leftJoin(products, eq(products.id, stock.productId))
    .leftJoin(locations, eq(locations.id, stock.locationId))
    .leftJoin(stockStatuses, eq(stockStatuses.id, stock.status))
    .where(and(eq(stock.locationId, locationId), eq(stock.barcode, code)))
    .limit(1);

  const rows = barcodeRows.length ? barcodeRows : await db.select({
    barcode: stock.barcode,
    costPrice: stock.costPrice,
    identifierType: stockIdentifiers.type,
    identifierValue: stockIdentifiers.value,
    locationId: stock.locationId,
    locationName: locations.name,
    productId: stock.productId,
    productMrpPrice: products.mrpPrice,
    productName: products.name,
    productSku: products.sku,
    statusId: stock.status,
    statusLabel: stockStatuses.label,
    statusName: stockStatuses.name,
    stockId: stock.id,
  }).from(stockIdentifiers)
    .innerJoin(stock, eq(stock.id, stockIdentifiers.stockId))
    .leftJoin(products, eq(products.id, stock.productId))
    .leftJoin(locations, eq(locations.id, stock.locationId))
    .leftJoin(stockStatuses, eq(stockStatuses.id, stock.status))
    .where(and(eq(stock.locationId, locationId), eq(stockIdentifiers.value, code)))
    .limit(1);

  const item = rows[0];
  if (!item) {
    return {
      found: false,
      message: 'No stock unit was found at your assigned location for this barcode, IMEI, or serial number.',
      query: code,
    };
  }

  const eligible = item.statusName === STOCK_STATUS.AVAILABLE;
  return {
    eligible,
    found: true,
    item: { ...item, costPrice: Number(item.costPrice), productMrpPrice: Number(item.productMrpPrice ?? 0) },
    message: eligible
      ? `${item.productName ?? 'Stock unit'} is available and can be added to this write-off.`
      : `${item.productName ?? 'Stock unit'} cannot be written off because its current status is ${item.statusLabel ?? 'unassigned'}.`,
    query: code,
  };
};

export const createStockDamage = async (input: unknown, user: AuthenticatedUser, context: AuditContext) => {
  const data = createStockDamageSchema.parse(input);
  const locationId = assignedLocationId(user);
  const approveImmediately = isAdministrator(user);
  const result = await db.transaction(async (transaction) => {
    const [availableStatus, damagedStatus] = await Promise.all([
      transaction.select().from(stockStatuses).where(eq(stockStatuses.name, STOCK_STATUS.AVAILABLE)).limit(1),
      transaction.select().from(stockStatuses).where(eq(stockStatuses.name, STOCK_STATUS.DAMAGED)).limit(1),
    ]);
    const available = availableStatus[0];
    const damaged = damagedStatus[0];
    if (!available || !damaged) throw new AppError('Required stock statuses are not configured. Contact an administrator.', 500);

    const units = await transaction.select({
      barcode: stock.barcode,
      costPrice: stock.costPrice,
      locationId: stock.locationId,
      maxRetailPrice: stock.maxRetailPrice,
      productId: stock.productId,
      productMrpPrice: products.mrpPrice,
      productName: products.name,
      stockId: stock.id,
      statusId: stock.status,
    }).from(stock)
      .leftJoin(products, eq(products.id, stock.productId))
      .where(inArray(stock.id, data.stockIds))
      .for('update');

    if (units.length !== data.stockIds.length) throw new AppError('One or more scanned stock units no longer exist.', 409);
    if (units.some((unit) => unit.locationId !== locationId)) throw new AppError('A scanned stock unit does not belong to your assigned location.', 403);
    if (units.some((unit) => unit.statusId !== available.id)) {
      throw new AppError('One or more scanned units are no longer available. Refresh the list and scan them again.', 409);
    }
    const pendingUnits = await transaction.select({ stockId: stockAdjustmentItems.stockId })
      .from(stockAdjustmentItems)
      .innerJoin(stockAdjustments, eq(stockAdjustments.id, stockAdjustmentItems.stockAdjustmentId))
      .where(and(
        eq(stockAdjustments.adjustmentType, 'damage'),
        inArray(stockAdjustmentItems.stockId, data.stockIds),
        eq(stockAdjustments.status, 'draft'),
      ))
      .for('update');
    if (pendingUnits.length) throw new AppError('One or more units already have a pending damage request.', 409);

    const year = currentYear();
    await transaction.insert(documentSequences).values({
      documentType: DOCUMENT_TYPES.STOCK_DAMAGE,
      lastNumber: 0,
      locationId,
      prefix: 'DAM',
      year,
    }).onDuplicateKeyUpdate({ set: { prefix: 'DAM' } });
    const [sequence] = await transaction.select().from(documentSequences).where(and(
      eq(documentSequences.documentType, DOCUMENT_TYPES.STOCK_DAMAGE),
      eq(documentSequences.locationId, locationId),
      eq(documentSequences.year, year),
    )).limit(1).for('update');
    if (!sequence) throw new AppError('Unable to create a damaged-stock document number.', 500);
    const nextNumber = Number(sequence.lastNumber) + 1;
    await transaction.update(documentSequences).set({ lastNumber: nextNumber }).where(eq(documentSequences.id, sequence.id));
    const documentNo = `${sequence.prefix}-${String(locationId).padStart(3, '0')}-${year}-${String(nextNumber).padStart(6, '0')}`;
    const now = Date.now();
    const [inserted] = await transaction.insert(stockAdjustments).values({
      adjustmentNo: documentNo,
      adjustmentType: 'damage',
      approvedBy: approveImmediately ? user.id : null,
      createdBy: user.id,
      locationId,
      reason: data.reason,
      status: approveImmediately ? 'approved' : 'draft',
      timestamp: now,
    });
    const adjustmentId = Number(inserted.insertId);
    const reasonLabel = stockDamageReasonLabels[data.reason];
    const note = data.note || null;

    await transaction.insert(stockAdjustmentItems).values(units.map((unit) => ({
      newCostPrice: '0.00',
      newLocationId: locationId,
      newStatus: damaged.id,
      note,
      oldCostPrice: money(Number(unit.costPrice)),
      oldLocationId: locationId,
      oldStatus: unit.statusId,
      stockAdjustmentId: adjustmentId,
      stockId: unit.stockId,
    })));
    if (approveImmediately) {
      await transaction.update(stock).set({ status: damaged.id }).where(inArray(stock.id, units.map((unit) => unit.stockId)));
      await transaction.insert(stockLogs).values(units.map((unit) => ({
        action: 'damage_write_off',
        newLocationId: locationId,
        newStatus: damaged.id,
        note: `${reasonLabel}${note ? ` — ${note}` : ''}`,
        previousLocationId: locationId,
        previousStatus: unit.statusId,
        referenceId: adjustmentId,
        referenceType: 'stock_damage',
        stockId: unit.stockId,
        timestamp: now,
        userId: user.id,
      })));
    }
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: approveImmediately ? 'damage_write_off' : 'damage_request_submitted',
      entityId: adjustmentId,
      newValues: {
        adjustmentNo: documentNo,
        reason: data.reason,
        stockIds: units.map((unit) => unit.stockId),
        unitCount: units.length,
      },
    }));

    const costLoss = units.reduce((total, unit) => total + Number(unit.costPrice), 0);
    const potentialSalesValue = units.reduce((total, unit) => total + Number(unit.maxRetailPrice ?? unit.productMrpPrice ?? 0), 0);
    return {
      adjustmentId,
      adjustmentNo: documentNo,
      costLoss,
      potentialGrossMargin: potentialSalesValue - costLoss,
      potentialSalesValue,
      reason: data.reason,
      reasonLabel,
      status: approveImmediately ? 'approved' : 'draft',
      timestamp: now,
      units: units.map((unit) => ({
        barcode: unit.barcode,
        costPrice: Number(unit.costPrice),
        productName: unit.productName,
        stockId: unit.stockId,
      })),
    };
  });
  if (!approveImmediately) {
    await safeCreateAdministratorNotifications({
      entityId: result.adjustmentId,
      entityType: 'stock_adjustment',
      locationId,
      message: `${user.displayName} submitted ${result.adjustmentNo} for ${result.units.length} damaged stock unit${result.units.length === 1 ? '' : 's'}: ${result.reasonLabel}.`,
      module: 'stock',
      severity: 'warning',
      title: 'Damaged stock approval needed',
    }, user.id);
  }
  return result;
};

export const approveStockDamage = async (idInput: unknown, user: AuthenticatedUser, context: AuditContext) => {
  const adjustmentId = stockDamageEntityIdSchema.parse(idInput);
  if (!isAdministrator(user)) throw new AppError('Only an administrator can approve damaged-stock requests.', 403);

  return db.transaction(async (transaction) => {
    const [request] = await transaction.select().from(stockAdjustments).where(and(
      eq(stockAdjustments.id, adjustmentId),
      eq(stockAdjustments.adjustmentType, 'damage'),
    )).limit(1).for('update');
    if (!request) throw new AppError('Damaged-stock request not found.', 404);
    if (request.status !== 'draft') throw new AppError('Only pending damaged-stock requests can be approved.', 409);

    const items = await transaction.select({
      costPrice: stockAdjustmentItems.oldCostPrice,
      stockId: stockAdjustmentItems.stockId,
    }).from(stockAdjustmentItems).where(eq(stockAdjustmentItems.stockAdjustmentId, adjustmentId)).for('update');
    if (!items.length) throw new AppError('This damaged-stock request does not contain any stock units.', 409);

    const [availableRows, damagedRows] = await Promise.all([
      transaction.select().from(stockStatuses).where(eq(stockStatuses.name, STOCK_STATUS.AVAILABLE)).limit(1),
      transaction.select().from(stockStatuses).where(eq(stockStatuses.name, STOCK_STATUS.DAMAGED)).limit(1),
    ]);
    const available = availableRows[0];
    const damaged = damagedRows[0];
    if (!available || !damaged) throw new AppError('Required stock statuses are not configured. Contact an administrator.', 500);

    const units = await transaction.select({
      barcode: stock.barcode,
      locationId: stock.locationId,
      productName: products.name,
      statusId: stock.status,
      stockId: stock.id,
    }).from(stock)
      .leftJoin(products, eq(products.id, stock.productId))
      .where(inArray(stock.id, items.map((item) => item.stockId)))
      .for('update');
    if (units.length !== items.length) throw new AppError('One or more requested stock units no longer exist.', 409);
    if (units.some((unit) => unit.locationId !== request.locationId || unit.statusId !== available.id)) {
      throw new AppError('One or more requested units are no longer available. They may have been sold or changed after the request was submitted.', 409);
    }

    const now = Date.now();
    const reasonLabel = stockDamageReasonLabels[request.reason as StockDamageReason] ?? request.reason;
    await transaction.update(stockAdjustments).set({ approvedBy: user.id, status: 'approved' }).where(eq(stockAdjustments.id, adjustmentId));
    await transaction.update(stock).set({ status: damaged.id }).where(inArray(stock.id, units.map((unit) => unit.stockId)));
    await transaction.insert(stockLogs).values(units.map((unit) => ({
      action: 'damage_write_off',
      newLocationId: request.locationId,
      newStatus: damaged.id,
      note: `${reasonLabel} — approved from ${request.adjustmentNo}`,
      previousLocationId: request.locationId,
      previousStatus: unit.statusId,
      referenceId: adjustmentId,
      referenceType: 'stock_damage',
      stockId: unit.stockId,
      timestamp: now,
      userId: user.id,
    })));
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: 'damage_request_approved',
      entityId: adjustmentId,
      newValues: { adjustmentNo: request.adjustmentNo, stockIds: units.map((unit) => unit.stockId), unitCount: units.length },
    }));
    const costLoss = items.reduce((total, item) => total + Number(item.costPrice ?? 0), 0);
    return { adjustmentId, adjustmentNo: request.adjustmentNo, costLoss, status: 'approved', units: units.length };
  });
};

export const declineStockDamage = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext) => {
  const adjustmentId = stockDamageEntityIdSchema.parse(idInput);
  const { note } = declineStockDamageSchema.parse(input);
  if (!isAdministrator(user)) throw new AppError('Only an administrator can decline damaged-stock requests.', 403);

  return db.transaction(async (transaction) => {
    const [request] = await transaction.select().from(stockAdjustments).where(and(
      eq(stockAdjustments.id, adjustmentId),
      eq(stockAdjustments.adjustmentType, 'damage'),
    )).limit(1).for('update');
    if (!request) throw new AppError('Damaged-stock request not found.', 404);
    if (request.status !== 'draft') throw new AppError('Only pending damaged-stock requests can be declined.', 409);

    await transaction.update(stockAdjustments).set({ decisionNote: note || null, status: 'declined' }).where(eq(stockAdjustments.id, adjustmentId));
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: 'damage_request_declined',
      entityId: adjustmentId,
      newValues: { adjustmentNo: request.adjustmentNo, note: note || null },
    }));
    return { adjustmentId, adjustmentNo: request.adjustmentNo, status: 'declined' };
  });
};

export const listStockDamage = async (input: unknown, user: AuthenticatedUser) => {
  const query = listStockDamageSchema.parse(input);
  const locationId = assignedLocationId(user);
  const filters: SQL[] = [
    eq(stockAdjustments.adjustmentType, 'damage'),
    eq(stockAdjustments.locationId, locationId),
  ];
  if (!isAdministrator(user)) filters.push(eq(stockAdjustments.createdBy, user.id));
  if (query.fromDate) filters.push(gte(stockAdjustments.timestamp, dateStart(query.fromDate)));
  if (query.toDate) filters.push(lte(stockAdjustments.timestamp, dateEnd(query.toDate)));
  if (query.search) {
    const term = `%${query.search}%`;
    filters.push(or(
      like(stockAdjustments.adjustmentNo, term),
      like(stock.barcode, term),
      like(products.name, term),
      like(products.sku, term),
    )!);
  }
  const where = and(...filters);
  const offset = (query.page - 1) * query.pageSize;
  const potentialSalesValue = sql<string>`coalesce(${stock.maxRetailPrice}, ${products.mrpPrice}, 0)`;

  const base = db.select({
    adjustmentId: stockAdjustments.id,
    adjustmentNo: stockAdjustments.adjustmentNo,
    barcode: stock.barcode,
    costLoss: stockAdjustmentItems.oldCostPrice,
    decisionNote: stockAdjustments.decisionNote,
    locationName: locations.name,
    note: stockAdjustmentItems.note,
    potentialSalesValue,
    productName: products.name,
    productSku: products.sku,
    reason: stockAdjustments.reason,
    recordedBy: users.displayName,
    status: stockAdjustments.status,
    stockId: stock.id,
    timestamp: stockAdjustments.timestamp,
  }).from(stockAdjustmentItems)
    .innerJoin(stockAdjustments, eq(stockAdjustments.id, stockAdjustmentItems.stockAdjustmentId))
    .innerJoin(stock, eq(stock.id, stockAdjustmentItems.stockId))
    .leftJoin(products, eq(products.id, stock.productId))
    .leftJoin(locations, eq(locations.id, stockAdjustments.locationId))
    .leftJoin(users, eq(users.id, stockAdjustments.createdBy));

  const [rows, [{ total }], [summary]] = await Promise.all([
    base.where(where).orderBy(desc(stockAdjustments.timestamp), desc(stockAdjustmentItems.id)).limit(query.pageSize).offset(offset),
    db.select({ total: count(stockAdjustmentItems.id) }).from(stockAdjustmentItems)
      .innerJoin(stockAdjustments, eq(stockAdjustments.id, stockAdjustmentItems.stockAdjustmentId))
      .innerJoin(stock, eq(stock.id, stockAdjustmentItems.stockId))
      .leftJoin(products, eq(products.id, stock.productId)).where(where),
    db.select({
      costLoss: sql<string>`coalesce(sum(${stockAdjustmentItems.oldCostPrice}), 0)`,
      potentialSalesValue: sql<string>`coalesce(sum(${potentialSalesValue}), 0)`,
      units: count(stockAdjustmentItems.id),
    }).from(stockAdjustmentItems)
      .innerJoin(stockAdjustments, eq(stockAdjustments.id, stockAdjustmentItems.stockAdjustmentId))
      .innerJoin(stock, eq(stock.id, stockAdjustmentItems.stockId))
      .leftJoin(products, eq(products.id, stock.productId)).where(and(...filters, eq(stockAdjustments.status, 'approved'))),
  ]);

  const costLoss = Number(summary?.costLoss ?? 0);
  const estimatedSalesValue = Number(summary?.potentialSalesValue ?? 0);
  return {
    items: rows.map((row) => ({
      ...row,
      costLoss: Number(row.costLoss ?? 0),
      potentialGrossMargin: Number(row.potentialSalesValue ?? 0) - Number(row.costLoss ?? 0),
      potentialSalesValue: Number(row.potentialSalesValue ?? 0),
      reasonLabel: stockDamageReasonLabels[row.reason as StockDamageReason] ?? row.reason,
      statusLabel: row.status === 'approved' ? 'Approved' : row.status === 'declined' ? 'Declined' : 'Pending approval',
    })),
    pagination: { page: query.page, pageSize: query.pageSize, total: Number(total), totalPages: Math.ceil(Number(total) / query.pageSize) },
    summary: {
      costLoss,
      potentialGrossMargin: estimatedSalesValue - costLoss,
      potentialSalesValue: estimatedSalesValue,
      units: Number(summary?.units ?? 0),
    },
  };
};
