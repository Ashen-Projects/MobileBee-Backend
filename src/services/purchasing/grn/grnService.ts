import { and, asc, count, desc, eq, inArray, like, or } from 'drizzle-orm';

import { db } from '../../../db';
import {
  auditLogs,
  documentSequences,
  grnCountItemEntries,
  grnCountSessions,
  grnDocuments,
  grnHistory,
  grnItems,
  grns,
  locations,
  products,
  purchaseOrderItems,
  purchaseOrders,
  purchaseOrderStatuses,
  stock,
  stockIdentifiers,
  stockLogs,
  stockStatuses,
  suppliers,
  users,
} from '../../../db/schema';
import { AppError } from '../../../errors/app-error';
import {
  DOCUMENT_TYPES,
  PURCHASE_ORDER_STATUS,
  TIME_ZONE,
  USER_ROLES,
} from '../../../utils/constants';
import type { AuthenticatedUser } from '../../auth/authService';
import {
  addGrnDocumentsSchema,
  addGrnNoteSchema,
  createGrnSchema,
  addGrnStockSchema,
  financeDecisionSchema,
  grnEntityIdSchema,
  listGrnsSchema,
  verifyGrnCountSchema,
} from './grnValidation';

type AuditContext = { ipAddress?: string };
type GrnStatus = 'pendingCountApproval' | 'pendingFinanceApproval' | 'approved' | 'declined';

const currentYear = () => Number(new Intl.DateTimeFormat('en', {
  timeZone: TIME_ZONE,
  year: 'numeric',
}).format(new Date()));

const audit = (user: AuthenticatedUser, context: AuditContext, values: {
  action: string;
  entityId: number;
  newValues?: unknown;
  oldValues?: unknown;
}) => ({
  ...values,
  entityType: 'grn',
  ipAddress: context.ipAddress,
  module: 'grns',
  timestamp: Date.now(),
  userId: user.id,
});

const money = (value: number) => (Math.round(value * 100) / 100).toFixed(2);

export const listGrns = async (input: unknown) => {
  const query = listGrnsSchema.parse(input);
  const filters = [];
  if (query.locationId !== 'all') filters.push(eq(grns.locationId, query.locationId));
  if (query.purchaseOrderId !== 'all') filters.push(eq(grns.purchaseOrderId, query.purchaseOrderId));
  if (query.supplierId !== 'all') filters.push(eq(grns.supplierId, query.supplierId));
  if (query.status !== 'all') filters.push(eq(grns.status, query.status));
  if (query.search) filters.push(or(
    like(grns.grnNumber, `%${query.search}%`),
    like(purchaseOrders.poNumber, `%${query.search}%`),
    like(suppliers.name, `%${query.search}%`),
    like(suppliers.code, `%${query.search}%`),
    like(grns.supplierDeliveryNote, `%${query.search}%`),
  ));
  const where = filters.length ? and(...filters) : undefined;
  const offset = (query.page - 1) * query.pageSize;
  const base = db.select({
    addedBy: grns.addedBy,
    addedByName: users.displayName,
    costTotal: grns.costTotal,
    grnNumber: grns.grnNumber,
    id: grns.id,
    locationId: grns.locationId,
    locationName: locations.name,
    paymentStatus: grns.paymentStatus,
    poNumber: purchaseOrders.poNumber,
    purchaseOrderId: grns.purchaseOrderId,
    status: grns.status,
    supplierCode: suppliers.code,
    supplierDeliveryNote: grns.supplierDeliveryNote,
    supplierId: grns.supplierId,
    supplierName: suppliers.name,
    timestamp: grns.timestamp,
  }).from(grns)
    .innerJoin(purchaseOrders, eq(grns.purchaseOrderId, purchaseOrders.id))
    .innerJoin(suppliers, eq(grns.supplierId, suppliers.id))
    .innerJoin(locations, eq(grns.locationId, locations.id))
    .innerJoin(users, eq(grns.addedBy, users.id));
  const [rows, [{ total }]] = await Promise.all([
    base.where(where).orderBy(desc(grns.id)).limit(query.pageSize).offset(offset),
    db.select({ total: count() }).from(grns)
      .innerJoin(purchaseOrders, eq(grns.purchaseOrderId, purchaseOrders.id))
      .innerJoin(suppliers, eq(grns.supplierId, suppliers.id))
      .where(where),
  ]);
  const itemRows = rows.length ? await db.select({
    grnId: grnItems.grnId,
    quantity: grnItems.quantity,
  }).from(grnItems).where(inArray(grnItems.grnId, rows.map(({ id }) => id))) : [];
  const quantities = itemRows.reduce((map, row) => {
    const value = map.get(row.grnId) ?? { itemCount: 0, totalQuantity: 0 };
    value.itemCount += 1;
    value.totalQuantity += row.quantity;
    map.set(row.grnId, value);
    return map;
  }, new Map<number, { itemCount: number; totalQuantity: number }>());
  return {
    items: rows.map((row) => ({ ...row, ...(quantities.get(row.id) ?? { itemCount: 0, totalQuantity: 0 }) })),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / query.pageSize),
    },
  };
};

export const getGrn = async (idInput: unknown) => {
  const id = grnEntityIdSchema.parse(idInput);
  const [header] = await db.select({
    addedBy: grns.addedBy,
    costTotal: grns.costTotal,
    counted2By: grns.counted2By,
    countedBy: grns.countedBy,
    financeApprovedBy: grns.financeApprovedBy,
    grnNumber: grns.grnNumber,
    id: grns.id,
    locationId: grns.locationId,
    locationName: locations.name,
    note: grns.note,
    paidAmount: grns.paidAmount,
    paymentStatus: grns.paymentStatus,
    poNumber: purchaseOrders.poNumber,
    purchaseOrderId: grns.purchaseOrderId,
    status: grns.status,
    supplierCode: suppliers.code,
    supplierDeliveryNote: grns.supplierDeliveryNote,
    supplierId: grns.supplierId,
    supplierName: suppliers.name,
    timestamp: grns.timestamp,
  }).from(grns)
    .innerJoin(purchaseOrders, eq(grns.purchaseOrderId, purchaseOrders.id))
    .innerJoin(suppliers, eq(grns.supplierId, suppliers.id))
    .innerJoin(locations, eq(grns.locationId, locations.id))
    .where(eq(grns.id, id)).limit(1);
  if (!header) throw new AppError('GRN not found.', 404);

  const [itemRows, stockRows, identifierRows, documents, history, counts] = await Promise.all([
    db.select({
      id: grnItems.id,
      productId: grnItems.productId,
      productName: products.name,
      productSku: products.sku,
      purchaseOrderItemId: grnItems.purchaseOrderItemId,
      quantity: grnItems.quantity,
      stockedQuantity: grnItems.stockedQuantity,
      totalAmount: grnItems.totalAmount,
      unitCost: grnItems.unitCost,
    }).from(grnItems).innerJoin(products, eq(grnItems.productId, products.id))
      .where(eq(grnItems.grnId, id)).orderBy(asc(grnItems.id)),
    db.select({
      barcode: stock.barcode,
      costPrice: stock.costPrice,
      id: stock.id,
      productId: stock.productId,
      status: stockStatuses.name,
      statusLabel: stockStatuses.label,
    }).from(stock).innerJoin(stockStatuses, eq(stock.status, stockStatuses.id))
      .where(eq(stock.grnId, id)).orderBy(asc(stock.id)),
    db.select({
      id: stockIdentifiers.id,
      isPrimary: stockIdentifiers.isPrimary,
      stockId: stockIdentifiers.stockId,
      type: stockIdentifiers.type,
      value: stockIdentifiers.value,
    }).from(stockIdentifiers).innerJoin(stock, eq(stockIdentifiers.stockId, stock.id))
      .where(eq(stock.grnId, id)).orderBy(asc(stockIdentifiers.id)),
    db.select().from(grnDocuments).where(eq(grnDocuments.grnId, id)).orderBy(desc(grnDocuments.id)),
    db.select().from(grnHistory).where(eq(grnHistory.grnId, id)).orderBy(desc(grnHistory.id)),
    db.select().from(grnCountSessions).where(eq(grnCountSessions.grnId, id)).orderBy(asc(grnCountSessions.id)),
  ]);
  const relevantUserIds = [header.addedBy, header.countedBy, header.counted2By, header.financeApprovedBy]
    .filter((value): value is number => value !== null);
  const userRows = relevantUserIds.length
    ? await db.select({ id: users.id, name: users.displayName }).from(users).where(inArray(users.id, relevantUserIds))
    : [];
  const userNames = new Map(userRows.map((row) => [row.id, row.name]));
  const identifiersByStock = identifierRows.reduce((map, row) => {
    const values = map.get(row.stockId) ?? [];
    values.push(row);
    map.set(row.stockId, values);
    return map;
  }, new Map<number, typeof identifierRows>());
  const stockByProduct = stockRows.reduce((map, row) => {
    if (row.productId === null) return map;
    const values = map.get(row.productId) ?? [];
    values.push({ ...row, identifiers: identifiersByStock.get(row.id) ?? [] });
    map.set(row.productId, values);
    return map;
  }, new Map<number, Array<(typeof stockRows)[number] & { identifiers: typeof identifierRows }>>());
  const availableStockedByProduct = stockRows.reduce((map, row) => {
    if (row.productId !== null && row.status === 'available') {
      map.set(row.productId, (map.get(row.productId) ?? 0) + 1);
    }
    return map;
  }, new Map<number, number>());
  return {
    ...header,
    addedByName: userNames.get(header.addedBy),
    counted2ByName: header.counted2By ? userNames.get(header.counted2By) : null,
    countedByName: header.countedBy ? userNames.get(header.countedBy) : null,
    financeApprovedByName: header.financeApprovedBy ? userNames.get(header.financeApprovedBy) : null,
    counts,
    documents,
    history,
    items: itemRows.map((item) => ({
      ...item,
      // Only sellable units are truly stocked. Pending placeholder rows from
      // an older flow must still be released through Add to Stock.
      stockedQuantity: availableStockedByProduct.get(item.productId) ?? 0,
      units: stockByProduct.get(item.productId) ?? [],
    })),
  };
};

export const createGrn = async (input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const data = createGrnSchema.parse(input);
  const grnId = await db.transaction(async (transaction) => {
    const [order] = await transaction.select({
      id: purchaseOrders.id,
      locationId: purchaseOrders.locationId,
      statusId: purchaseOrders.status,
      statusName: purchaseOrderStatuses.name,
      supplierId: purchaseOrders.supplierId,
    }).from(purchaseOrders)
      .innerJoin(purchaseOrderStatuses, eq(purchaseOrders.status, purchaseOrderStatuses.id))
      .where(eq(purchaseOrders.id, data.purchaseOrderId)).limit(1).for('update');
    if (!order) throw new AppError('Purchase order not found.', 404);
    if (order.statusName !== PURCHASE_ORDER_STATUS.ORDERED
      && order.statusName !== PURCHASE_ORDER_STATUS.PARTIALLY_RECEIVED) {
      throw new AppError('A GRN can only be created from an ordered or partially received purchase order.', 409);
    }

    const orderItems = await transaction.select({
      id: purchaseOrderItems.id,
      maxPurchasingPrice: products.maxPurchasingPrice,
      orderedQuantity: purchaseOrderItems.quantity,
      productId: purchaseOrderItems.productId,
      productName: products.name,
      receivedQuantity: purchaseOrderItems.receivedQuantity,
    }).from(purchaseOrderItems).innerJoin(products, eq(purchaseOrderItems.productId, products.id))
      .where(eq(purchaseOrderItems.purchaseOrderId, order.id)).for('update');
    const orderItemById = new Map(orderItems.map((item) => [item.id, item]));
    const pendingRows = await transaction.select({
      purchaseOrderItemId: grnItems.purchaseOrderItemId,
      quantity: grnItems.quantity,
    }).from(grnItems).innerJoin(grns, eq(grnItems.grnId, grns.id)).where(and(
      eq(grns.purchaseOrderId, order.id),
      inArray(grns.status, ['pendingCountApproval', 'pendingFinanceApproval']),
    ));
    const pendingByItem = pendingRows.reduce((map, row) => {
      map.set(row.purchaseOrderItemId, (map.get(row.purchaseOrderItemId) ?? 0) + row.quantity);
      return map;
    }, new Map<number, number>());

    let totalCents = 0;
    for (const item of data.items) {
      const orderItem = orderItemById.get(item.purchaseOrderItemId);
      if (!orderItem) throw new AppError(`Purchase-order item ${item.purchaseOrderItemId} does not belong to this order.`, 400);
      const remaining = orderItem.orderedQuantity - orderItem.receivedQuantity - (pendingByItem.get(orderItem.id) ?? 0);
      if (item.quantity > remaining) {
        throw new AppError(`Received quantity for '${orderItem.productName}' exceeds the remaining quantity of ${remaining}.`, 409);
      }
      if (item.unitCost > Number(orderItem.maxPurchasingPrice)) {
        throw new AppError(`Unit cost for '${orderItem.productName}' exceeds its maximum purchasing price.`, 400);
      }
      totalCents += Math.round(item.unitCost * 100) * item.quantity;
    }

    const year = currentYear();
    await transaction.insert(documentSequences).values({
      documentType: DOCUMENT_TYPES.GOODS_RECEIVED_NOTE,
      lastNumber: 0,
      locationId: order.locationId,
      prefix: 'GRN',
      year,
    }).onDuplicateKeyUpdate({ set: { prefix: 'GRN' } });
    const [grnSequence] = await transaction.select().from(documentSequences).where(and(
      eq(documentSequences.documentType, DOCUMENT_TYPES.GOODS_RECEIVED_NOTE),
      eq(documentSequences.locationId, order.locationId),
      eq(documentSequences.year, year),
    )).limit(1).for('update');
    if (!grnSequence) throw new AppError('GRN document sequence could not be initialized.', 500);
    const grnSequenceNumber = Number(grnSequence.lastNumber) + 1;
    const grnNumber = `${grnSequence.prefix}-${String(order.locationId).padStart(3, '0')}-${year}-${String(grnSequenceNumber).padStart(6, '0')}`;
    await transaction.update(documentSequences).set({ lastNumber: grnSequenceNumber })
      .where(eq(documentSequences.id, grnSequence.id));

    const timestamp = Date.now();
    const inserted = await transaction.insert(grns).values({
      addedBy: user.id,
      costTotal: money(totalCents / 100),
      grnNumber,
      locationId: order.locationId,
      note: data.note,
      purchaseOrderId: order.id,
      status: 'pendingCountApproval',
      supplierDeliveryNote: data.supplierDeliveryNote,
      supplierId: order.supplierId,
      timestamp,
    });
    const id = Number(inserted[0].insertId);
    for (const item of data.items) {
      const orderItem = orderItemById.get(item.purchaseOrderItemId)!;
      const totalAmount = money(item.unitCost * item.quantity);
      await transaction.insert(grnItems).values({
        grnId: id,
        productId: orderItem.productId,
        purchaseOrderItemId: orderItem.id,
        quantity: item.quantity,
        stockedQuantity: 0,
        totalAmount,
        unitCost: money(item.unitCost),
      });
    }
    if (data.documents.length) {
      await transaction.insert(grnDocuments).values(data.documents.map((document) => ({
        ...document,
        grnId: id,
        timestamp,
        uploadedBy: user.id,
      })));
    }
    await transaction.insert(grnHistory).values({
      action: 'create',
      grnId: id,
      newStatus: 'pendingCountApproval',
      note: data.note,
      timestamp,
      userId: user.id,
    });
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: 'create',
      entityId: id,
      newValues: { grnNumber, purchaseOrderId: order.id, totalAmount: money(totalCents / 100) },
    }));
    return id;
  });
  return getGrn(grnId);
};

export const verifyGrnCount = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = grnEntityIdSchema.parse(idInput);
  const data = verifyGrnCountSchema.parse(input);
  const isAdministrator = user.roles.some(({ name }) => name === USER_ROLES.ADMIN);
  const result = await db.transaction(async (transaction) => {
    const [current] = await transaction.select().from(grns).where(eq(grns.id, id)).limit(1).for('update');
    if (!current) throw new AppError('GRN not found.', 404);
    if (current.status !== 'pendingCountApproval') throw new AppError('This GRN is not waiting for a physical count.', 409);
    const sessions = await transaction.select().from(grnCountSessions).where(eq(grnCountSessions.grnId, id));
    const first = sessions.find(({ countNumber }) => countNumber === 'first');
    const second = sessions.find(({ countNumber }) => countNumber === 'second');
    if (data.countNumber === 'first' && first) throw new AppError('The first count has already been completed.', 409);
    if (data.countNumber === 'second') {
      if (!first) throw new AppError('Complete the first count before the second count.', 409);
      if (second) throw new AppError('The second count has already been completed.', 409);
      if (first.countedBy === user.id && !isAdministrator) {
        throw new AppError('The second count must be completed by a different user.', 409);
      }
    }

    const receivedItems = await transaction.select({ id: grnItems.id, quantity: grnItems.quantity })
      .from(grnItems).where(eq(grnItems.grnId, id)).for('update');
    const expectedByItem = new Map(receivedItems.map((item) => [item.id, item.quantity]));
    const countedByItem = new Map(data.items.map((item) => [item.grnItemId, item.countedQuantity]));
    const unexpectedItemIds = data.items.map(({ grnItemId }) => grnItemId).filter((itemId) => !expectedByItem.has(itemId));
    const mismatches = receivedItems.flatMap((item) => {
      const countedQuantity = countedByItem.get(item.id);
      return countedQuantity === item.quantity ? [] : [{ expectedQuantity: item.quantity, grnItemId: item.id, countedQuantity: countedQuantity ?? 0 }];
    });
    const isMatched = unexpectedItemIds.length === 0 && mismatches.length === 0;
    const timestamp = Date.now();
    if (!isMatched) {
      await transaction.insert(grnHistory).values({
        action: 'count_mismatch',
        grnId: id,
        newStatus: current.status,
        note: JSON.stringify({
          countNumber: data.countNumber,
          mismatches,
          unexpectedItemIds,
        }),
        previousStatus: current.status,
        timestamp,
        userId: user.id,
      });
      await transaction.insert(auditLogs).values(audit(user, context, {
        action: 'count_mismatch', entityId: id,
        newValues: { countNumber: data.countNumber, mismatches, unexpectedItemIds },
      }));
      return { matched: false } as const;
    }
    const inserted = await transaction.insert(grnCountSessions).values({
      countedBy: user.id,
      countNumber: data.countNumber,
      grnId: id,
      isMatched: true,
      timestamp,
    });
    const sessionId = Number(inserted[0].insertId);
    await transaction.insert(grnCountItemEntries).values(data.items.map((item) => ({
      countSessionId: sessionId,
      countedQuantity: item.countedQuantity,
      grnItemId: item.grnItemId,
    })));
    const isSecond = data.countNumber === 'second';
    await transaction.update(grns).set(isSecond
      ? { counted2By: user.id, status: 'pendingFinanceApproval' }
      : { countedBy: user.id })
      .where(eq(grns.id, id));
    await transaction.insert(grnHistory).values({
      action: isSecond ? 'second_count_approved' : 'first_count_approved',
      grnId: id,
      newStatus: isSecond ? 'pendingFinanceApproval' : current.status,
      previousStatus: current.status,
      timestamp,
      userId: user.id,
    });
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: isSecond ? 'second_count_approved' : 'first_count_approved',
      entityId: id,
      newValues: { countNumber: data.countNumber, totalQuantity: receivedItems.reduce((sum, item) => sum + item.quantity, 0) },
    }));
    return { matched: true } as const;
  });
  if (!result.matched) {
    throw new AppError('Physical count does not match the received quantity for every product. No approval was recorded.', 409);
  }
  return getGrn(id);
};

export const decideGrnFinance = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = grnEntityIdSchema.parse(idInput);
  const data = financeDecisionSchema.parse(input);
  const isAdministrator = user.roles.some(({ name }) => name === USER_ROLES.ADMIN);
  await db.transaction(async (transaction) => {
    const [current] = await transaction.select().from(grns).where(eq(grns.id, id)).limit(1).for('update');
    if (!current) throw new AppError('GRN not found.', 404);
    if (current.status !== 'pendingFinanceApproval') throw new AppError('This GRN is not waiting for finance approval.', 409);
    if (!current.countedBy || !current.counted2By || (current.countedBy === current.counted2By && !isAdministrator)) {
      throw new AppError('Two independent physical counts are required before finance approval.', 409);
    }
    const timestamp = Date.now();
    if (data.status === 'approved') {
      const [order] = await transaction.select().from(purchaseOrders)
        .where(eq(purchaseOrders.id, current.purchaseOrderId)).limit(1).for('update');
      if (!order) throw new AppError('Related purchase order not found.', 500);
      const receivedItems = await transaction.select().from(grnItems).where(eq(grnItems.grnId, id));
      const orderItems = await transaction.select().from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderId, order.id)).for('update');
      const receivedByOrderItem = new Map(receivedItems.map((item) => [item.purchaseOrderItemId, item]));
      for (const orderItem of orderItems) {
        const received = receivedByOrderItem.get(orderItem.id)?.quantity ?? 0;
        const newQuantity = orderItem.receivedQuantity + received;
        if (newQuantity > orderItem.quantity) throw new AppError('GRN approval would exceed a purchase-order quantity.', 409);
        if (received) {
          await transaction.update(purchaseOrderItems).set({ receivedQuantity: newQuantity })
            .where(eq(purchaseOrderItems.id, orderItem.id));
        }
        orderItem.receivedQuantity = newQuantity;
      }
      const isFullyReceived = orderItems.every((item) => item.receivedQuantity === item.quantity);
      const targetPoStatusName = isFullyReceived ? PURCHASE_ORDER_STATUS.RECEIVED : PURCHASE_ORDER_STATUS.PARTIALLY_RECEIVED;
      const [targetPoStatus] = await transaction.select().from(purchaseOrderStatuses)
        .where(eq(purchaseOrderStatuses.name, targetPoStatusName)).limit(1);
      if (!targetPoStatus) throw new AppError(`Purchase-order status '${targetPoStatusName}' is not configured.`, 500);
      await transaction.update(purchaseOrders).set({ status: targetPoStatus.id }).where(eq(purchaseOrders.id, order.id));
    }
    await transaction.update(grns).set({ financeApprovedBy: user.id, status: data.status }).where(eq(grns.id, id));
    await transaction.insert(grnHistory).values({
      action: data.status === 'approved' ? 'finance_approved' : 'finance_declined',
      grnId: id,
      newStatus: data.status,
      note: data.note,
      previousStatus: current.status,
      timestamp,
      userId: user.id,
    });
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: data.status === 'approved' ? 'finance_approved' : 'finance_declined',
      entityId: id,
      newValues: { note: data.note, status: data.status },
      oldValues: { status: current.status },
    }));
  });
  return getGrn(id);
};

export const addGrnStock = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = grnEntityIdSchema.parse(idInput);
  const data = addGrnStockSchema.parse(input);
  await db.transaction(async (transaction) => {
    const [current] = await transaction.select().from(grns).where(eq(grns.id, id)).limit(1).for('update');
    if (!current) throw new AppError('GRN not found.', 404);
    if (current.status !== 'approved') throw new AppError('Only finance-approved GRNs can be added to stock.', 409);

    const receivedItems = await transaction.select().from(grnItems).where(eq(grnItems.grnId, id)).for('update');
    const receivedById = new Map(receivedItems.map((item) => [item.id, item]));
    const [[availableStatus], [pendingApprovalStatus]] = await Promise.all([
      transaction.select().from(stockStatuses).where(eq(stockStatuses.name, 'available')).limit(1),
      transaction.select().from(stockStatuses).where(eq(stockStatuses.name, 'pending_grn_approval')).limit(1),
    ]);
    if (!availableStatus) throw new AppError('Available stock status is not configured.', 500);
    const existingStock = await transaction.select({ id: stock.id, productId: stock.productId, status: stock.status })
      .from(stock).where(eq(stock.grnId, id)).for('update');
    const availableByProduct = existingStock.reduce((map, row) => {
      if (row.productId !== null && row.status === availableStatus.id) {
        map.set(row.productId, (map.get(row.productId) ?? 0) + 1);
      }
      return map;
    }, new Map<number, number>());
    const placeholderByProduct = existingStock.reduce((map, row) => {
      if (row.productId !== null && pendingApprovalStatus && row.status === pendingApprovalStatus.id) {
        const values = map.get(row.productId) ?? [];
        values.push(row.id);
        map.set(row.productId, values);
      }
      return map;
    }, new Map<number, number[]>());
    const explicitCodes = data.items.flatMap(({ units }) => units.flatMap((unit) => [
      ...(unit.barcode ? [unit.barcode] : []),
      ...unit.identifiers.map(({ value }) => value),
    ]));
    if (new Set(explicitCodes).size !== explicitCodes.length) {
      throw new AppError('Every barcode, IMEI, and serial number must be unique.', 409);
    }
    if (explicitCodes.length) {
      const [existingBarcodes, existingIdentifiers] = await Promise.all([
        transaction.select({ value: stock.barcode }).from(stock).where(inArray(stock.barcode, explicitCodes)),
        transaction.select({ value: stockIdentifiers.value }).from(stockIdentifiers).where(inArray(stockIdentifiers.value, explicitCodes)),
      ]);
      if (existingBarcodes.length || existingIdentifiers.length) {
        throw new AppError('One or more barcode, IMEI, or serial numbers already exist.', 409);
      }
    }
    for (const item of data.items) {
      const received = receivedById.get(item.grnItemId);
      if (!received) throw new AppError(`GRN item ${item.grnItemId} does not belong to this GRN.`, 400);
      const remainingQuantity = received.quantity - (availableByProduct.get(received.productId) ?? 0);
      if (item.units.length > remainingQuantity) {
        throw new AppError(`Only ${remainingQuantity} unit(s) remain available for '${received.productId}'.`, 409);
      }
    }

    const generatedCount = data.items.flatMap(({ units }) => units).filter(({ generateBarcode }) => generateBarcode).length;
    let generatedStart = 0;
    const year = currentYear();
    if (generatedCount) {
      await transaction.insert(documentSequences).values({
        documentType: DOCUMENT_TYPES.STOCK_BARCODE,
        lastNumber: 0,
        locationId: current.locationId,
        prefix: 'MB',
        year,
      }).onDuplicateKeyUpdate({ set: { prefix: 'MB' } });
      const [sequence] = await transaction.select().from(documentSequences).where(and(
        eq(documentSequences.documentType, DOCUMENT_TYPES.STOCK_BARCODE),
        eq(documentSequences.locationId, current.locationId),
        eq(documentSequences.year, year),
      )).limit(1).for('update');
      if (!sequence) throw new AppError('Barcode sequence could not be initialized.', 500);
      generatedStart = Math.max(10_001, Number(sequence.lastNumber) + 1);
      await transaction.update(documentSequences).set({ lastNumber: generatedStart + generatedCount - 1 })
        .where(eq(documentSequences.id, sequence.id));
    }
    let generatedOffset = 0;
    const timestamp = Date.now();
    for (const item of data.items) {
      const received = receivedById.get(item.grnItemId)!;
      for (const unit of item.units) {
        const barcode = unit.generateBarcode ? `MB-${String(generatedStart + generatedOffset++).padStart(5, '0')}` : unit.barcode;
        const placeholderIds = placeholderByProduct.get(received.productId) ?? [];
        const placeholderId = placeholderIds.shift();
        const stockId = placeholderId ?? Number((await transaction.insert(stock).values({
          barcode,
          costPrice: received.unitCost,
          gCostPrice: received.unitCost,
          grnId: id,
          latestAvailableDateTime: timestamp,
          locationId: current.locationId,
          maxRetailPrice: null,
          onlinePrice: null,
          productId: received.productId,
          purchaseOrderId: current.purchaseOrderId,
          status: availableStatus.id,
          supplierId: current.supplierId,
          timestamp,
        }))[0].insertId);
        if (placeholderId) {
          await transaction.update(stock).set({
            barcode,
            costPrice: received.unitCost,
            gCostPrice: received.unitCost,
            latestAvailableDateTime: timestamp,
            status: availableStatus.id,
          }).where(eq(stock.id, placeholderId));
        }
        if (unit.identifiers.length) {
          const hasPrimary = unit.identifiers.some(({ isPrimary }) => isPrimary);
          await transaction.insert(stockIdentifiers).values(unit.identifiers.map((identifier, index) => ({
            isPrimary: identifier.isPrimary || (!barcode && !hasPrimary && index === 0),
            stockId,
            type: identifier.type,
            value: identifier.value,
          })));
        }
        await transaction.insert(stockLogs).values({
          action: 'grn_stock_added', newLocationId: current.locationId, newStatus: availableStatus.id,
          referenceId: id, referenceType: 'grn', stockId, timestamp, userId: user.id,
        });
      }
      await transaction.update(grnItems).set({
        stockedQuantity: (availableByProduct.get(received.productId) ?? 0) + item.units.length,
      })
        .where(eq(grnItems.id, received.id));
    }
    await transaction.insert(grnHistory).values({
      action: 'stock_added', grnId: id, newStatus: current.status,
      note: `${data.items.reduce((sum, item) => sum + item.units.length, 0)} unit(s) added to stock.`,
      previousStatus: current.status, timestamp, userId: user.id,
    });
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: 'stock_added', entityId: id,
      newValues: { units: data.items.reduce((sum, item) => sum + item.units.length, 0) },
    }));
  });
  return getGrn(id);
};

export const addGrnDocuments = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = grnEntityIdSchema.parse(idInput);
  const data = addGrnDocumentsSchema.parse(input);
  await db.transaction(async (transaction) => {
    const [current] = await transaction.select({ id: grns.id, status: grns.status }).from(grns)
      .where(eq(grns.id, id)).limit(1).for('update');
    if (!current) throw new AppError('GRN not found.', 404);
    const timestamp = Date.now();
    await transaction.insert(grnDocuments).values(data.documents.map((document) => ({
      ...document, grnId: id, timestamp, uploadedBy: user.id,
    })));
    await transaction.insert(grnHistory).values({
      action: 'documents_added', grnId: id, newStatus: current.status,
      note: `${data.documents.length} document(s) attached.`, previousStatus: current.status, timestamp, userId: user.id,
    });
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: 'documents_added', entityId: id, newValues: { count: data.documents.length },
    }));
  });
  return getGrn(id);
};

export const addGrnNote = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = grnEntityIdSchema.parse(idInput);
  const { note } = addGrnNoteSchema.parse(input);
  await db.transaction(async (transaction) => {
    const [current] = await transaction.select({ id: grns.id, status: grns.status }).from(grns)
      .where(eq(grns.id, id)).limit(1);
    if (!current) throw new AppError('GRN not found.', 404);
    const timestamp = Date.now();
    await transaction.insert(grnHistory).values({
      action: 'note_added', grnId: id, newStatus: current.status, note,
      previousStatus: current.status, timestamp, userId: user.id,
    });
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: 'note_added', entityId: id, newValues: { note },
    }));
  });
  return getGrn(id);
};
