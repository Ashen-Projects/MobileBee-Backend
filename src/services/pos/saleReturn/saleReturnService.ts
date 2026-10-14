import { and, count, desc, eq, inArray, like, or } from 'drizzle-orm';

import { db } from '../../../db';
import {
  auditLogs,
  customers,
  documentSequences,
  locations,
  posDrawers,
  products,
  saleItemStock,
  saleItems,
  saleReturnExchangeItems,
  saleReturnItems,
  saleReturnPayments,
  saleReturns,
  sales,
  stock,
  stockAdjustmentItems,
  stockAdjustments,
  stockLogs,
  stockStatuses,
  users,
} from '../../../db/schema';
import { AppError } from '../../../errors/app-error';
import type { AuthenticatedUser } from '../../auth/authService';
import { safeCreateAdministratorNotifications } from '../../notification/notificationService';
import { DOCUMENT_TYPES, STOCK_STATUS, TIME_ZONE, USER_ROLES } from '../../../utils/constants';
import { createSaleExchangeSchema, listSaleReturnsSchema, saleReturnIdSchema, saleReturnLookupSchema } from './saleReturnValidation';

type AuditContext = { ipAddress?: string };

const EXCHANGE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const money = (value: number) => Number(value.toFixed(2));
const isAdministrator = (user: AuthenticatedUser) => user.roles.some(({ name }) => name === USER_ROLES.ADMIN);
const year = () => Number(new Intl.DateTimeFormat('en', { timeZone: TIME_ZONE, year: 'numeric' }).format(new Date()));

const assignedLocationId = (user: AuthenticatedUser) => {
  if (!user.defaultLocationId) throw new AppError('Your account does not have an assigned sale location.', 400);
  return user.defaultLocationId;
};

const returnDetail = async (id: number) => {
  const [header] = await db.select({
    balanceAmount: saleReturns.balanceAmount,
    createdByName: users.displayName,
    customerName: customers.name,
    customerPhone: customers.phone,
    exchangeTotal: saleReturns.exchangeTotal,
    id: saleReturns.id,
    locationName: locations.name,
    originalInvoiceNo: sales.invoiceNo,
    originalSaleId: sales.id,
    reason: saleReturns.reason,
    returnNo: saleReturns.returnNo,
    status: saleReturns.status,
    timestamp: saleReturns.timestamp,
    totalAmount: saleReturns.totalAmount,
  }).from(saleReturns)
    .innerJoin(sales, eq(sales.id, saleReturns.saleId))
    .leftJoin(customers, eq(customers.id, saleReturns.customerId))
    .innerJoin(locations, eq(locations.id, saleReturns.locationId))
    .innerJoin(users, eq(users.id, saleReturns.createdBy))
    .where(eq(saleReturns.id, id)).limit(1);
  if (!header) throw new AppError('Exchange bill not found.', 404);

  const [returnedItems, replacements, payments] = await Promise.all([
    db.select({
      barcode: stock.barcode,
      condition: saleReturnItems.condition,
      disposition: saleReturnItems.disposition,
      productName: products.name,
      productSku: products.sku,
      refundAmount: saleReturnItems.refundAmount,
      stockId: saleReturnItems.stockId,
    }).from(saleReturnItems)
      .leftJoin(stock, eq(stock.id, saleReturnItems.stockId))
      .innerJoin(saleItems, eq(saleItems.id, saleReturnItems.saleItemId))
      .innerJoin(products, eq(products.id, saleItems.productId))
      .where(eq(saleReturnItems.saleReturnId, id)).orderBy(saleReturnItems.id),
    db.select({
      barcode: stock.barcode,
      productName: products.name,
      productSku: products.sku,
      stockId: saleReturnExchangeItems.stockId,
      totalAmount: saleReturnExchangeItems.totalAmount,
      unitPrice: saleReturnExchangeItems.unitPrice,
    }).from(saleReturnExchangeItems)
      .innerJoin(stock, eq(stock.id, saleReturnExchangeItems.stockId))
      .innerJoin(products, eq(products.id, saleReturnExchangeItems.productId))
      .where(eq(saleReturnExchangeItems.saleReturnId, id)).orderBy(saleReturnExchangeItems.id),
    db.select({
      amount: saleReturnPayments.amount,
      method: saleReturnPayments.method,
      referenceNo: saleReturnPayments.referenceNo,
    }).from(saleReturnPayments).where(eq(saleReturnPayments.saleReturnId, id)).orderBy(saleReturnPayments.id),
  ]);
  return { ...header, payments, replacements, returnedItems };
};

const resolveOriginalSale = async (search: string, locationId: number) => {
  const basicSelection = {
    customerId: sales.customerId,
    customerName: customers.name,
    customerPhone: customers.phone,
    id: sales.id,
    invoiceNo: sales.invoiceNo,
    locationId: sales.locationId,
    status: sales.status,
    timestamp: sales.timestamp,
  };
  let sale = (await db.select(basicSelection).from(sales)
    .leftJoin(customers, eq(customers.id, sales.customerId))
    .where(eq(sales.invoiceNo, search)).limit(1))[0];
  if (!sale) {
    sale = (await db.select(basicSelection).from(stock)
      .innerJoin(saleItemStock, eq(saleItemStock.stockId, stock.id))
      .innerJoin(saleItems, eq(saleItems.id, saleItemStock.saleItemId))
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .leftJoin(customers, eq(customers.id, sales.customerId))
      .where(eq(stock.barcode, search)).limit(1))[0];
  }
  if (!sale) throw new AppError('Original completed sale was not found.', 404);
  if (sale.locationId !== locationId) throw new AppError('The original sale belongs to another location.', 403);
  if (sale.status !== 'completed') throw new AppError('Only completed sales can be exchanged.', 409);
  const elapsed = Date.now() - Number(sale.timestamp);
  if (elapsed < 0 || elapsed > EXCHANGE_WINDOW_MS) throw new AppError('Items can be exchanged only within 7 days of the original sale.', 409);
  return sale;
};

export const lookupSaleReturn = async (input: unknown, user: AuthenticatedUser) => {
  const { search } = saleReturnLookupSchema.parse(input);
  const sale = await resolveOriginalSale(search, assignedLocationId(user));
  const soldStatus = (await db.select({ id: stockStatuses.id }).from(stockStatuses).where(eq(stockStatuses.name, STOCK_STATUS.SOLD)).limit(1))[0];
  if (!soldStatus) throw new AppError('Stock status configuration is incomplete.', 500);
  const items = await db.select({
    barcode: stock.barcode,
    productId: products.id,
    productName: products.name,
    productSku: products.sku,
    saleItemId: saleItems.id,
    saleItemTotal: saleItems.totalAmount,
    saleQuantity: saleItems.quantity,
    stockId: stock.id,
    status: stock.status,
  }).from(saleItemStock)
    .innerJoin(saleItems, eq(saleItems.id, saleItemStock.saleItemId))
    .innerJoin(stock, eq(stock.id, saleItemStock.stockId))
    .innerJoin(products, eq(products.id, saleItems.productId))
    .where(eq(saleItems.saleId, sale.id)).orderBy(saleItems.id, stock.id);
  return {
    sale: {
      ...sale,
      daysRemaining: Math.max(0, Math.ceil((EXCHANGE_WINDOW_MS - elapsedSince(sale.timestamp)) / (24 * 60 * 60 * 1000))),
    },
    items: items.map((item) => ({
      ...item,
      eligible: item.status === soldStatus.id,
      returnAmount: money(Number(item.saleItemTotal) / item.saleQuantity),
    })),
  };
};

const elapsedSince = (timestamp: number) => Date.now() - Number(timestamp);

export const createSaleExchange = async (input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const data = createSaleExchangeSchema.parse(input);
  const locationId = assignedLocationId(user);
  if (new Set(data.returnedItems.map((item) => item.stockId)).size !== data.returnedItems.length) throw new AppError('A returned unit can be selected only once.', 400);
  if (data.replacementStockIds.some((id) => data.returnedItems.some((item) => item.stockId === id))) {
    throw new AppError('The same physical stock unit cannot be both returned and issued as a replacement.', 400);
  }

  const result = await db.transaction(async (transaction) => {
    const [original] = await transaction.select({ customerId: sales.customerId, id: sales.id, invoiceNo: sales.invoiceNo, locationId: sales.locationId, status: sales.status, timestamp: sales.timestamp })
      .from(sales).where(eq(sales.id, data.originalSaleId)).limit(1).for('update');
    if (!original) throw new AppError('Original sale was not found.', 404);
    if (original.locationId !== locationId) throw new AppError('The original sale belongs to another location.', 403);
    if (original.status !== 'completed') throw new AppError('Only completed sales can be exchanged.', 409);
    if (elapsedSince(original.timestamp) < 0 || elapsedSince(original.timestamp) > EXCHANGE_WINDOW_MS) {
      throw new AppError('Items can be exchanged only within 7 days of the original sale.', 409);
    }

    const [[available], [sold], [damaged], [pendingDamage]] = await Promise.all([
      transaction.select({ id: stockStatuses.id }).from(stockStatuses).where(eq(stockStatuses.name, STOCK_STATUS.AVAILABLE)).limit(1),
      transaction.select({ id: stockStatuses.id }).from(stockStatuses).where(eq(stockStatuses.name, STOCK_STATUS.SOLD)).limit(1),
      transaction.select({ id: stockStatuses.id }).from(stockStatuses).where(eq(stockStatuses.name, STOCK_STATUS.DAMAGED)).limit(1),
      transaction.select({ id: stockStatuses.id }).from(stockStatuses).where(eq(stockStatuses.name, STOCK_STATUS.PENDING_DAMAGE_APPROVAL)).limit(1),
    ]);
    if (!available?.id || !sold?.id || !damaged?.id || !pendingDamage?.id) throw new AppError('Required stock statuses are not configured. Apply the latest database migration.', 500);
    const [drawer] = await transaction.select({ id: posDrawers.id }).from(posDrawers)
      .where(and(eq(posDrawers.locationId, locationId), eq(posDrawers.status, 'open'))).limit(1).for('update');
    if (!drawer) throw new AppError('Open the POS drawer for this location before creating an exchange.', 409);

    const returnStockIds = data.returnedItems.map((item) => item.stockId);
    const returned = await transaction.select({
      barcode: stock.barcode,
      costPrice: stock.costPrice,
      saleItemId: saleItems.id,
      saleItemTotal: saleItems.totalAmount,
      saleQuantity: saleItems.quantity,
      stockId: stock.id,
      status: stock.status,
    }).from(saleItemStock)
      .innerJoin(saleItems, eq(saleItems.id, saleItemStock.saleItemId))
      .innerJoin(stock, eq(stock.id, saleItemStock.stockId))
      .where(and(eq(saleItems.saleId, original.id), inArray(stock.id, returnStockIds))).for('update');
    if (returned.length !== returnStockIds.length) throw new AppError('Every returned unit must belong to the selected original sale.', 409);
    if (returned.some((item) => item.status !== sold.id)) throw new AppError('One or more original units were already returned or are no longer eligible.', 409);

    const replacements = await transaction.select({
      barcode: stock.barcode,
      locationId: stock.locationId,
      maxRetailPrice: stock.maxRetailPrice,
      mrpPrice: products.mrpPrice,
      productId: products.id,
      productName: products.name,
      stockId: stock.id,
      status: stock.status,
    }).from(stock).innerJoin(products, eq(products.id, stock.productId))
      .where(inArray(stock.id, data.replacementStockIds)).for('update');
    if (replacements.length !== data.replacementStockIds.length) throw new AppError('One or more replacement stock units were not found.', 404);
    if (replacements.some((item) => item.locationId !== locationId || item.status !== available.id)) throw new AppError('One or more replacement units are no longer available at this location.', 409);
    if (replacements.some((item) => Number(item.maxRetailPrice ?? item.mrpPrice ?? 0) <= 0)) throw new AppError('A replacement item is missing its MRP.', 409);

    const returnTotal = money(returned.reduce((sum, item) => sum + Number(item.saleItemTotal) / item.saleQuantity, 0));
    const exchangeTotal = money(replacements.reduce((sum, item) => sum + Number(item.maxRetailPrice ?? item.mrpPrice), 0));
    if (exchangeTotal < returnTotal) throw new AppError('Choose a replacement with an equal or higher total. Cash refunds and unused return balances are not available.', 400);
    const balanceAmount = money(exchangeTotal - returnTotal);
    const collected = money(data.payments.reduce((sum, payment) => sum + payment.amount, 0));
    if (collected !== balanceAmount) throw new AppError(`Collected payment must exactly match the exchange balance (${balanceAmount.toFixed(2)}).`, 400);
    if (!balanceAmount && data.payments.length) throw new AppError('No payment is needed for an equal-value exchange.', 400);

    const currentYear = year();
    await transaction.insert(documentSequences).values({ documentType: DOCUMENT_TYPES.SALE_RETURN, lastNumber: 0, locationId, prefix: 'RET', year: currentYear })
      .onDuplicateKeyUpdate({ set: { prefix: 'RET' } });
    const [sequence] = await transaction.select().from(documentSequences).where(and(
      eq(documentSequences.documentType, DOCUMENT_TYPES.SALE_RETURN), eq(documentSequences.locationId, locationId), eq(documentSequences.year, currentYear),
    )).limit(1).for('update');
    if (!sequence) throw new AppError('Exchange document sequence could not be initialized.', 500);
    const nextNumber = Number(sequence.lastNumber) + 1;
    await transaction.update(documentSequences).set({ lastNumber: nextNumber }).where(eq(documentSequences.id, sequence.id));
    const returnNo = `${sequence.prefix}-${String(locationId).padStart(3, '0')}-${currentYear}-${String(nextNumber).padStart(6, '0')}`;
    const timestamp = Date.now();
    const inserted = await transaction.insert(saleReturns).values({
      balanceAmount: String(balanceAmount),
      createdBy: user.id,
      customerId: original.customerId,
      drawerId: drawer.id,
      exchangeTotal: String(exchangeTotal),
      locationId,
      reason: data.reason,
      returnNo,
      saleId: original.id,
      status: 'completed',
      timestamp,
      totalAmount: String(returnTotal),
    });
    const saleReturnId = Number(inserted[0].insertId);
    const requestedReturn = new Map(data.returnedItems.map((item) => [item.stockId, item]));
    await transaction.insert(saleReturnItems).values(returned.map((item) => {
      const request = requestedReturn.get(item.stockId)!;
      const isDamaged = request.disposition === 'damage';
      return {
        condition: isDamaged ? 'damaged' as const : 'opened' as const,
        disposition: request.disposition,
        refundAmount: String(money(Number(item.saleItemTotal) / item.saleQuantity)),
        restockStatus: isDamaged ? (isAdministrator(user) ? damaged.id : pendingDamage.id) : available.id,
        saleItemId: item.saleItemId,
        saleReturnId,
        stockId: item.stockId,
      };
    }));
    await transaction.insert(saleReturnExchangeItems).values(replacements.map((item) => {
      const unitPrice = money(Number(item.maxRetailPrice ?? item.mrpPrice));
      return { productId: item.productId, saleReturnId, stockId: item.stockId, totalAmount: String(unitPrice), unitPrice: String(unitPrice) };
    }));
    if (data.payments.length) await transaction.insert(saleReturnPayments).values(data.payments.map((payment) => ({
      amount: String(money(payment.amount)), method: payment.method, receivedBy: user.id, referenceNo: payment.referenceNo || null, saleReturnId, timestamp,
    })));

    const restockIds = data.returnedItems.filter((item) => item.disposition === 'restock').map((item) => item.stockId);
    const damageIds = data.returnedItems.filter((item) => item.disposition === 'damage').map((item) => item.stockId);
    if (restockIds.length) await transaction.update(stock).set({ status: available.id }).where(inArray(stock.id, restockIds));
    if (damageIds.length) await transaction.update(stock).set({ status: isAdministrator(user) ? damaged.id : pendingDamage.id }).where(inArray(stock.id, damageIds));
    await transaction.update(stock).set({ status: sold.id }).where(inArray(stock.id, replacements.map((item) => item.stockId)));

    if (damageIds.length) {
      await transaction.insert(documentSequences).values({ documentType: DOCUMENT_TYPES.STOCK_DAMAGE, lastNumber: 0, locationId, prefix: 'DAM', year: currentYear })
        .onDuplicateKeyUpdate({ set: { prefix: 'DAM' } });
      const [damageSequence] = await transaction.select().from(documentSequences).where(and(
        eq(documentSequences.documentType, DOCUMENT_TYPES.STOCK_DAMAGE), eq(documentSequences.locationId, locationId), eq(documentSequences.year, currentYear),
      )).limit(1).for('update');
      if (!damageSequence) throw new AppError('Damage document sequence could not be initialized.', 500);
      const nextDamage = Number(damageSequence.lastNumber) + 1;
      await transaction.update(documentSequences).set({ lastNumber: nextDamage }).where(eq(documentSequences.id, damageSequence.id));
      const adjustmentNo = `${damageSequence.prefix}-${String(locationId).padStart(3, '0')}-${currentYear}-${String(nextDamage).padStart(6, '0')}`;
      const adjustment = await transaction.insert(stockAdjustments).values({
        adjustmentNo, adjustmentType: 'damage', approvedBy: isAdministrator(user) ? user.id : null, createdBy: user.id, locationId,
        reason: 'customer_return_damage', status: isAdministrator(user) ? 'approved' : 'draft', timestamp,
      });
      const adjustmentId = Number(adjustment[0].insertId);
      await transaction.insert(stockAdjustmentItems).values(returned.filter((item) => damageIds.includes(item.stockId)).map((item) => ({
        newCostPrice: '0.00', newLocationId: locationId, newStatus: isAdministrator(user) ? damaged.id : pendingDamage.id,
        note: `Customer exchange ${returnNo}`, oldCostPrice: item.costPrice, oldLocationId: locationId, oldStatus: sold.id,
        stockAdjustmentId: adjustmentId, stockId: item.stockId,
      })));
      await transaction.insert(stockLogs).values(damageIds.map((stockId) => ({
        action: isAdministrator(user) ? 'customer_return_damage' : 'damage_request_hold', newLocationId: locationId,
        newStatus: isAdministrator(user) ? damaged.id : pendingDamage.id, note: `Customer exchange ${returnNo}`,
        previousLocationId: locationId, previousStatus: sold.id, referenceId: adjustmentId, referenceType: 'stock_damage', stockId, timestamp, userId: user.id,
      })));
    }
    const returnById = new Map(returned.map((item) => [item.stockId, item]));
    if (restockIds.length) await transaction.insert(stockLogs).values(restockIds.map((stockId) => ({
      action: 'customer_exchange_return', newLocationId: locationId, newStatus: available.id, note: `Customer exchange ${returnNo}`,
      previousLocationId: locationId, previousStatus: returnById.get(stockId)!.status, referenceId: saleReturnId, referenceType: 'sale_return', stockId, timestamp, userId: user.id,
    })));
    await transaction.insert(stockLogs).values(replacements.map((item) => ({
      action: 'customer_exchange_replacement', newLocationId: locationId, newStatus: sold.id, note: `Customer exchange ${returnNo}`,
      previousLocationId: locationId, previousStatus: available.id, referenceId: saleReturnId, referenceType: 'sale_return', stockId: item.stockId, timestamp, userId: user.id,
    })));
    await transaction.insert(auditLogs).values({
      action: 'customer_exchange_completed', entityId: saleReturnId, entityType: 'sale_return', ipAddress: context.ipAddress, module: 'sales',
      newValues: { balanceAmount, exchangeTotal, originalSaleId: original.id, returnNo, returnTotal, returnedStockIds: returnStockIds, replacementStockIds: data.replacementStockIds },
      timestamp, userId: user.id,
    });
    return { damagePending: damageIds.length > 0 && !isAdministrator(user), returnNo, saleReturnId };
  });
  if (result.damagePending) {
    await safeCreateAdministratorNotifications({
      entityId: result.saleReturnId, entityType: 'sale_return', locationId,
      message: `${user.displayName} completed exchange ${result.returnNo} with damaged returned item(s) awaiting write-off approval.`,
      module: 'stock', severity: 'warning', title: 'Damage approval needed',
    }, user.id);
  }
  return returnDetail(result.saleReturnId);
};

export const getSaleReturn = async (input: unknown, user: AuthenticatedUser) => {
  const value = await returnDetail(saleReturnIdSchema.parse(input));
  if (value.locationName && assignedLocationId(user) !== undefined) {
    // The header is queried again only to enforce location scope without exposing
    // exchange records from another branch.
    const [row] = await db.select({ locationId: saleReturns.locationId }).from(saleReturns).where(eq(saleReturns.id, value.id)).limit(1);
    if (!row || row.locationId !== assignedLocationId(user)) throw new AppError('Exchange bill not found.', 404);
  }
  return value;
};

export const listSaleReturns = async (input: unknown, user: AuthenticatedUser) => {
  const query = listSaleReturnsSchema.parse(input);
  const locationId = assignedLocationId(user);
  const where = and(eq(saleReturns.locationId, locationId), query.search ? or(
    like(saleReturns.returnNo, `%${query.search}%`), like(sales.invoiceNo, `%${query.search}%`), like(customers.name, `%${query.search}%`),
  ) : undefined);
  const offset = (query.page - 1) * query.pageSize;
  const [items, [{ total }]] = await Promise.all([
    db.select({ balanceAmount: saleReturns.balanceAmount, customerName: customers.name, exchangeTotal: saleReturns.exchangeTotal, id: saleReturns.id, originalInvoiceNo: sales.invoiceNo, returnNo: saleReturns.returnNo, status: saleReturns.status, timestamp: saleReturns.timestamp, totalAmount: saleReturns.totalAmount })
      .from(saleReturns).innerJoin(sales, eq(sales.id, saleReturns.saleId)).leftJoin(customers, eq(customers.id, saleReturns.customerId))
      .where(where).orderBy(desc(saleReturns.id)).limit(query.pageSize).offset(offset),
    db.select({ total: count() }).from(saleReturns).innerJoin(sales, eq(sales.id, saleReturns.saleId)).leftJoin(customers, eq(customers.id, saleReturns.customerId)).where(where),
  ]);
  return { items, pagination: { page: query.page, pageSize: query.pageSize, total: Number(total), totalPages: Math.ceil(Number(total) / query.pageSize) } };
};
