import { and, asc, count, desc, eq, inArray, like, or } from 'drizzle-orm';

import { db } from '../../../db';
import {
  auditLogs,
  documentSequences,
  grns,
  locations,
  products,
  purchaseOrderItems,
  purchaseOrderLogs,
  purchaseOrders,
  purchaseOrderStatuses,
  supplierProducts,
  suppliers,
  users,
} from '../../../db/schema';
import { AppError } from '../../../errors/app-error';
import { DOCUMENT_TYPES, PURCHASE_ORDER_STATUS, TIME_ZONE } from '../../../utils/constants';
import type { AuthenticatedUser } from '../../auth/authService';
import {
  createPurchaseOrderSchema,
  entityIdSchema,
  listPurchaseOrdersSchema,
  transitionPurchaseOrderSchema,
  updatePurchaseOrderSchema,
} from './purchaseOrderValidation';

type AuditContext = { ipAddress?: string };
type OrderItemInput = { productId: number; quantity: number; unitPrice: number };
type StatusName = (typeof PURCHASE_ORDER_STATUS)[keyof typeof PURCHASE_ORDER_STATUS];

const audit = (user: AuthenticatedUser, context: AuditContext, values: {
  action: string;
  entityId: number;
  newValues?: unknown;
  oldValues?: unknown;
}) => ({
  ...values,
  entityType: 'purchase_order',
  ipAddress: context.ipAddress,
  module: 'purchase_orders',
  timestamp: Date.now(),
  userId: user.id,
});

const currentYear = () => Number(new Intl.DateTimeFormat('en', {
  timeZone: TIME_ZONE,
  year: 'numeric',
}).format(new Date()));

const findStatus = async (name: StatusName) => {
  const [status] = await db.select().from(purchaseOrderStatuses)
    .where(eq(purchaseOrderStatuses.name, name)).limit(1);
  if (!status) throw new AppError(`Purchase order status '${name}' is not configured.`, 500);
  return status;
};

const validateOrderSelection = async (supplierId: number, locationId: number, items: OrderItemInput[]) => {
  const [[supplier], [location]] = await Promise.all([
    db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1),
    db.select().from(locations).where(eq(locations.id, locationId)).limit(1),
  ]);
  if (!supplier || !supplier.isActive) throw new AppError('Select an active supplier.', 400);
  if (!location || !location.isActive) throw new AppError('Select an active location.', 400);

  const productIds = items.map(({ productId }) => productId);
  const [productRows, links] = await Promise.all([
    db.select().from(products).where(inArray(products.id, productIds)),
    db.select().from(supplierProducts).where(and(
      eq(supplierProducts.supplierId, supplierId),
      eq(supplierProducts.isActive, true),
      inArray(supplierProducts.productId, productIds),
    )),
  ]);
  const productById = new Map(productRows.map((product) => [product.id, product]));
  const linkByProductId = new Map(links.map((link) => [link.productId, link]));

  let totalCents = 0;
  const rows = items.map((item) => {
    const product = productById.get(item.productId);
    const link = linkByProductId.get(item.productId);
    if (!product || !product.isActive) throw new AppError(`Product ${item.productId} is not active or does not exist.`, 400);
    if (product.hasVariations) throw new AppError(`Select a sellable variation of '${product.name}', not its parent product.`, 400);
    if (!link) throw new AppError(`'${product.name}' is not linked to the selected supplier.`, 400);
    if (item.quantity < link.minimumOrderQty) {
      throw new AppError(`'${product.name}' requires a minimum order quantity of ${link.minimumOrderQty}.`, 400);
    }
    if (item.unitPrice > Number(product.maxPurchasingPrice)) {
      throw new AppError(`Expected price for '${product.name}' exceeds its maximum purchasing price.`, 400);
    }
    const unitCents = Math.round(item.unitPrice * 100);
    const itemTotalCents = unitCents * item.quantity;
    totalCents += itemTotalCents;
    return {
      productId: item.productId,
      quantity: item.quantity,
      supplierProductId: link.id,
      totalAmount: (itemTotalCents / 100).toFixed(2),
      unitPrice: (unitCents / 100).toFixed(2),
    };
  });

  return { location, rows, supplier, totalAmount: (totalCents / 100).toFixed(2) };
};

export const listPurchaseOrderStatuses = async () => db.select().from(purchaseOrderStatuses)
  .orderBy(asc(purchaseOrderStatuses.priority), asc(purchaseOrderStatuses.id));

export const listPurchaseOrders = async (input: unknown) => {
  const query = listPurchaseOrdersSchema.parse(input);
  const filters = [];
  if (query.locationId !== 'all') filters.push(eq(purchaseOrders.locationId, query.locationId));
  if (query.supplierId !== 'all') filters.push(eq(purchaseOrders.supplierId, query.supplierId));
  if (query.status !== 'all') filters.push(eq(purchaseOrderStatuses.name, query.status));
  if (query.search) filters.push(or(
    like(purchaseOrders.poNumber, `%${query.search}%`),
    like(suppliers.name, `%${query.search}%`),
    like(suppliers.code, `%${query.search}%`),
  ));
  const where = filters.length ? and(...filters) : undefined;
  const offset = (query.page - 1) * query.pageSize;
  const base = db.select({
    id: purchaseOrders.id,
    locationId: purchaseOrders.locationId,
    locationName: locations.name,
    poNumber: purchaseOrders.poNumber,
    status: purchaseOrderStatuses.name,
    statusLabel: purchaseOrderStatuses.label,
    supplierCode: suppliers.code,
    supplierId: purchaseOrders.supplierId,
    supplierName: suppliers.name,
    timestamp: purchaseOrders.timestamp,
    totalAmount: purchaseOrders.totalAmount,
    userId: purchaseOrders.userId,
    userName: users.displayName,
  }).from(purchaseOrders)
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .innerJoin(locations, eq(purchaseOrders.locationId, locations.id))
    .innerJoin(purchaseOrderStatuses, eq(purchaseOrders.status, purchaseOrderStatuses.id))
    .innerJoin(users, eq(purchaseOrders.userId, users.id));
  const [rows, [{ total }]] = await Promise.all([
    base.where(where).orderBy(desc(purchaseOrders.id)).limit(query.pageSize).offset(offset),
    db.select({ total: count() }).from(purchaseOrders)
      .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .innerJoin(purchaseOrderStatuses, eq(purchaseOrders.status, purchaseOrderStatuses.id))
      .where(where),
  ]);
  const itemRows = rows.length ? await db.select({
    purchaseOrderId: purchaseOrderItems.purchaseOrderId,
    quantity: purchaseOrderItems.quantity,
  }).from(purchaseOrderItems).where(inArray(purchaseOrderItems.purchaseOrderId, rows.map(({ id }) => id))) : [];
  const summaries = itemRows.reduce((map, row) => {
    const current = map.get(row.purchaseOrderId) ?? { itemCount: 0, totalQuantity: 0 };
    current.itemCount += 1;
    current.totalQuantity += row.quantity;
    map.set(row.purchaseOrderId, current);
    return map;
  }, new Map<number, { itemCount: number; totalQuantity: number }>());
  return {
    items: rows.map((row) => ({ ...row, ...(summaries.get(row.id) ?? { itemCount: 0, totalQuantity: 0 }) })),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / query.pageSize),
    },
  };
};

export const getPurchaseOrder = async (idInput: unknown) => {
  const id = entityIdSchema.parse(idInput);
  const [header] = await db.select({
    id: purchaseOrders.id,
    locationId: purchaseOrders.locationId,
    locationName: locations.name,
    poNumber: purchaseOrders.poNumber,
    status: purchaseOrderStatuses.name,
    statusId: purchaseOrders.status,
    statusLabel: purchaseOrderStatuses.label,
    supplierCode: suppliers.code,
    supplierId: purchaseOrders.supplierId,
    supplierName: suppliers.name,
    timestamp: purchaseOrders.timestamp,
    totalAmount: purchaseOrders.totalAmount,
    userId: purchaseOrders.userId,
    userName: users.displayName,
  }).from(purchaseOrders)
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .innerJoin(locations, eq(purchaseOrders.locationId, locations.id))
    .innerJoin(purchaseOrderStatuses, eq(purchaseOrders.status, purchaseOrderStatuses.id))
    .innerJoin(users, eq(purchaseOrders.userId, users.id))
    .where(eq(purchaseOrders.id, id)).limit(1);
  if (!header) throw new AppError('Purchase order not found.', 404);

  const [items, logs] = await Promise.all([
    db.select({
      id: purchaseOrderItems.id,
      productId: purchaseOrderItems.productId,
      productName: products.name,
      productSku: products.sku,
      quantity: purchaseOrderItems.quantity,
      receivedQuantity: purchaseOrderItems.receivedQuantity,
      supplierProductCode: supplierProducts.supplierProductCode,
      supplierProductId: purchaseOrderItems.supplierProductId,
      totalAmount: purchaseOrderItems.totalAmount,
      unitPrice: purchaseOrderItems.unitPrice,
    }).from(purchaseOrderItems)
      .innerJoin(products, eq(purchaseOrderItems.productId, products.id))
      .innerJoin(supplierProducts, eq(purchaseOrderItems.supplierProductId, supplierProducts.id))
      .where(eq(purchaseOrderItems.purchaseOrderId, id)).orderBy(asc(purchaseOrderItems.id)),
    db.select({
      action: purchaseOrderLogs.action,
      id: purchaseOrderLogs.id,
      newStatus: purchaseOrderLogs.newStatus,
      note: purchaseOrderLogs.note,
      previousStatus: purchaseOrderLogs.previousStatus,
      timestamp: purchaseOrderLogs.timestamp,
      userId: purchaseOrderLogs.userId,
      userName: users.displayName,
    }).from(purchaseOrderLogs).innerJoin(users, eq(purchaseOrderLogs.userId, users.id))
      .where(eq(purchaseOrderLogs.purchaseOrderId, id)).orderBy(desc(purchaseOrderLogs.id)),
  ]);
  return { ...header, items, logs };
};

export const createPurchaseOrder = async (input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const data = createPurchaseOrderSchema.parse(input);
  const selection = await validateOrderSelection(data.supplierId, data.locationId, data.items);
  const draft = await findStatus(PURCHASE_ORDER_STATUS.DRAFT);
  const id = await db.transaction(async (transaction) => {
    const year = currentYear();
    await transaction.insert(documentSequences).values({
      documentType: DOCUMENT_TYPES.PURCHASE_ORDER,
      lastNumber: 0,
      locationId: data.locationId,
      prefix: 'PO',
      year,
    }).onDuplicateKeyUpdate({ set: { prefix: 'PO' } });
    const [sequence] = await transaction.select().from(documentSequences).where(and(
      eq(documentSequences.documentType, DOCUMENT_TYPES.PURCHASE_ORDER),
      eq(documentSequences.locationId, data.locationId),
      eq(documentSequences.year, year),
    )).limit(1).for('update');
    if (!sequence) throw new AppError('Purchase order sequence could not be initialized.', 500);
    const nextNumber = Number(sequence.lastNumber) + 1;
    const poNumber = `${sequence.prefix}-${String(data.locationId).padStart(3, '0')}-${year}-${String(nextNumber).padStart(6, '0')}`;
    await transaction.update(documentSequences).set({ lastNumber: nextNumber })
      .where(eq(documentSequences.id, sequence.id));
    const timestamp = Date.now();
    const result = await transaction.insert(purchaseOrders).values({
      locationId: data.locationId,
      poNumber,
      status: draft.id,
      supplierId: data.supplierId,
      timestamp,
      totalAmount: selection.totalAmount,
      userId: user.id,
    });
    const purchaseOrderId = Number(result[0].insertId);
    await transaction.insert(purchaseOrderItems).values(selection.rows.map((item) => ({
      ...item,
      purchaseOrderId,
      receivedQuantity: 0,
      timestamp,
    })));
    await transaction.insert(purchaseOrderLogs).values({
      action: 'create',
      newStatus: draft.id,
      note: data.note,
      purchaseOrderId,
      timestamp,
      userId: user.id,
    });
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: 'create',
      entityId: purchaseOrderId,
      newValues: { ...data, poNumber, totalAmount: selection.totalAmount },
    }));
    return purchaseOrderId;
  });
  return getPurchaseOrder(id);
};

export const updatePurchaseOrder = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = entityIdSchema.parse(idInput);
  const data = updatePurchaseOrderSchema.parse(input);
  const draft = await findStatus(PURCHASE_ORDER_STATUS.DRAFT);
  await db.transaction(async (transaction) => {
    const [current] = await transaction.select().from(purchaseOrders)
      .where(eq(purchaseOrders.id, id)).limit(1).for('update');
    if (!current) throw new AppError('Purchase order not found.', 404);
    if (current.status !== draft.id) throw new AppError('Only draft purchase orders can be edited.', 409);
    const currentItems = await transaction.select().from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, id)).orderBy(asc(purchaseOrderItems.id));
    const items = data.items ?? currentItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
    }));
    const supplierId = data.supplierId ?? current.supplierId;
    const locationId = data.locationId ?? current.locationId;
    const selection = await validateOrderSelection(supplierId, locationId, items);
    const timestamp = Date.now();
    let poNumber = current.poNumber;
    if (locationId !== current.locationId) {
      const year = currentYear();
      await transaction.insert(documentSequences).values({
        documentType: DOCUMENT_TYPES.PURCHASE_ORDER,
        lastNumber: 0,
        locationId,
        prefix: 'PO',
        year,
      }).onDuplicateKeyUpdate({ set: { prefix: 'PO' } });
      const [sequence] = await transaction.select().from(documentSequences).where(and(
        eq(documentSequences.documentType, DOCUMENT_TYPES.PURCHASE_ORDER),
        eq(documentSequences.locationId, locationId),
        eq(documentSequences.year, year),
      )).limit(1).for('update');
      if (!sequence) throw new AppError('Purchase order sequence could not be initialized.', 500);
      const nextNumber = Number(sequence.lastNumber) + 1;
      poNumber = `${sequence.prefix}-${String(locationId).padStart(3, '0')}-${year}-${String(nextNumber).padStart(6, '0')}`;
      await transaction.update(documentSequences).set({ lastNumber: nextNumber })
        .where(eq(documentSequences.id, sequence.id));
    }
    await transaction.update(purchaseOrders).set({
      locationId,
      poNumber,
      supplierId,
      totalAmount: selection.totalAmount,
    }).where(eq(purchaseOrders.id, id));
    await transaction.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));
    await transaction.insert(purchaseOrderItems).values(selection.rows.map((item) => ({
      ...item,
      purchaseOrderId: id,
      receivedQuantity: 0,
      timestamp,
    })));
    await transaction.insert(purchaseOrderLogs).values({
      action: 'update',
      newStatus: draft.id,
      note: data.note,
      previousStatus: draft.id,
      purchaseOrderId: id,
      timestamp,
      userId: user.id,
    });
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: 'update',
      entityId: id,
      newValues: { ...data, poNumber, totalAmount: selection.totalAmount },
      oldValues: current,
    }));
  });
  return getPurchaseOrder(id);
};

const transitionPurchaseOrder = async (
  idInput: unknown,
  input: unknown,
  user: AuthenticatedUser,
  context: AuditContext,
  action: string,
  allowedFrom: StatusName[],
  targetName: StatusName,
) => {
  const id = entityIdSchema.parse(idInput);
  const { note } = transitionPurchaseOrderSchema.parse(input);
  await db.transaction(async (transaction) => {
    const [current] = await transaction.select().from(purchaseOrders)
      .where(eq(purchaseOrders.id, id)).limit(1).for('update');
    if (!current) throw new AppError('Purchase order not found.', 404);
    const statuses = await transaction.select().from(purchaseOrderStatuses)
      .where(inArray(purchaseOrderStatuses.name, [...allowedFrom, targetName]));
    const statusByName = new Map(statuses.map((status) => [status.name, status]));
    const currentStatus = statuses.find((status) => status.id === current.status);
    const target = statusByName.get(targetName);
    if (!currentStatus || !allowedFrom.includes(currentStatus.name as StatusName)) {
      throw new AppError(`Purchase order cannot be ${action.replace(/_/g, ' ')} from its current status.`, 409);
    }
    if (!target) throw new AppError(`Purchase order status '${targetName}' is not configured.`, 500);
    if (targetName === PURCHASE_ORDER_STATUS.CANCELLED) {
      const [activeGrn] = await transaction.select({ id: grns.id }).from(grns).where(and(
        eq(grns.purchaseOrderId, id),
        inArray(grns.status, ['pendingCountApproval', 'pendingFinanceApproval', 'approved']),
      )).limit(1);
      if (activeGrn) {
        throw new AppError('This purchase order cannot be cancelled because it has a GRN in progress or approved stock.', 409);
      }
    }
    if (
      targetName === PURCHASE_ORDER_STATUS.PENDING_APPROVAL
      || targetName === PURCHASE_ORDER_STATUS.APPROVED
      || targetName === PURCHASE_ORDER_STATUS.ORDERED
    ) {
      const items = await transaction.select().from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderId, id));
      await validateOrderSelection(current.supplierId, current.locationId, items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
      })));
    }
    const timestamp = Date.now();
    await transaction.update(purchaseOrders).set({ status: target.id }).where(eq(purchaseOrders.id, id));
    await transaction.insert(purchaseOrderLogs).values({
      action,
      newStatus: target.id,
      note,
      previousStatus: current.status,
      purchaseOrderId: id,
      timestamp,
      userId: user.id,
    });
    await transaction.insert(auditLogs).values(audit(user, context, {
      action,
      entityId: id,
      newValues: { note, status: targetName },
      oldValues: { status: currentStatus.name },
    }));
  });
  return getPurchaseOrder(id);
};

export const submitPurchaseOrder = (id: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => (
  transitionPurchaseOrder(id, input, user, context, 'submit_for_approval', [PURCHASE_ORDER_STATUS.DRAFT], PURCHASE_ORDER_STATUS.PENDING_APPROVAL)
);
export const approvePurchaseOrder = (id: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => (
  transitionPurchaseOrder(id, input, user, context, 'approve', [PURCHASE_ORDER_STATUS.PENDING_APPROVAL], PURCHASE_ORDER_STATUS.APPROVED)
);
export const rejectPurchaseOrder = (id: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => (
  transitionPurchaseOrder(id, input, user, context, 'reject', [PURCHASE_ORDER_STATUS.PENDING_APPROVAL], PURCHASE_ORDER_STATUS.REJECTED)
);
export const markPurchaseOrderOrdered = (id: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => (
  transitionPurchaseOrder(id, input, user, context, 'mark_ordered', [PURCHASE_ORDER_STATUS.APPROVED], PURCHASE_ORDER_STATUS.ORDERED)
);
export const cancelPurchaseOrder = (id: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => (
  transitionPurchaseOrder(id, input, user, context, 'cancel', [
    PURCHASE_ORDER_STATUS.DRAFT,
    PURCHASE_ORDER_STATUS.PENDING_APPROVAL,
    PURCHASE_ORDER_STATUS.APPROVED,
    PURCHASE_ORDER_STATUS.ORDERED,
  ], PURCHASE_ORDER_STATUS.CANCELLED)
);
