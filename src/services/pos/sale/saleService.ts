import { and, count, desc, eq, inArray, like, or, sql, type SQL } from 'drizzle-orm';

import { db } from '../../../db';
import {
  auditLogs,
  customers,
  documentSequences,
  locations,
  products,
  saleItems,
  saleItemStock,
  salePayments,
  sales,
  stock,
  stockIdentifiers,
  stockStatuses,
  users,
} from '../../../db/schema';
import { AppError } from '../../../errors/app-error';
import type { AuthenticatedUser } from '../../auth/authService';
import { DOCUMENT_TYPES, STOCK_STATUS } from '../../../utils/constants';
import { createSaleSchema, dailySalesSummarySchema, listSalesSchema, saleIdSchema, searchSaleCustomersSchema, searchSaleProductsSchema } from './saleValidation';

type AuditContext = { ipAddress?: string };

const currentYear = () => Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Colombo', year: 'numeric' }).format(new Date()));
const money = (value: number) => Number(value.toFixed(2));
const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const startOfColomboDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) - COLOMBO_OFFSET_MS;
};

const endOfColomboDate = (date: string) => startOfColomboDate(date) + 24 * 60 * 60 * 1000 - 1;

const colomboDayKey = (timestamp: number) => {
  const local = new Date(timestamp + COLOMBO_OFFSET_MS);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
};

const eachColomboDate = (fromDate: string, toDate: string) => {
  const dates: string[] = [];
  let cursor = startOfColomboDate(fromDate);
  const end = startOfColomboDate(toDate);
  while (cursor <= end) {
    dates.push(colomboDayKey(cursor + COLOMBO_OFFSET_MS));
    cursor += 24 * 60 * 60 * 1000;
  }
  return dates;
};

const findStatusId = async (name: string) => {
  const [status] = await db.select({ id: stockStatuses.id }).from(stockStatuses).where(eq(stockStatuses.name, name)).limit(1);
  if (!status) throw new AppError(`Stock status '${name}' is not configured.`, 500);
  return status.id;
};

const ensureInvoiceNumber = async (transaction: Parameters<Parameters<typeof db.transaction>[0]>[0], locationId: number) => {
  const year = currentYear();
  await transaction.insert(documentSequences).values({
    documentType: DOCUMENT_TYPES.SALE_INVOICE,
    lastNumber: 0,
    locationId,
    prefix: 'INV',
    year,
  }).onDuplicateKeyUpdate({ set: { prefix: 'INV' } });
  const [sequence] = await transaction.select().from(documentSequences).where(and(
    eq(documentSequences.documentType, DOCUMENT_TYPES.SALE_INVOICE),
    eq(documentSequences.locationId, locationId),
    eq(documentSequences.year, year),
  )).limit(1).for('update');
  if (!sequence) throw new AppError('Sale invoice sequence could not be initialized.', 500);
  const nextNumber = Number(sequence.lastNumber) + 1;
  await transaction.update(documentSequences).set({ lastNumber: nextNumber }).where(eq(documentSequences.id, sequence.id));
  return `${sequence.prefix}-${String(locationId).padStart(3, '0')}-${year}-${String(nextNumber).padStart(6, '0')}`;
};

const saleDetail = async (id: number) => {
  const [header] = await db.select({
    customerId: sales.customerId,
    customerName: customers.name,
    customerPhone: customers.phone,
    discountAmount: sales.discountAmount,
    id: sales.id,
    invoiceNo: sales.invoiceNo,
    locationId: sales.locationId,
    locationName: locations.name,
    paidAmount: sales.paidAmount,
    status: sales.status,
    subTotal: sales.subTotal,
    timestamp: sales.timestamp,
    totalAmount: sales.totalAmount,
    userId: sales.userId,
    userName: users.displayName,
  }).from(sales)
    .leftJoin(customers, eq(customers.id, sales.customerId))
    .innerJoin(locations, eq(locations.id, sales.locationId))
    .innerJoin(users, eq(users.id, sales.userId))
    .where(eq(sales.id, id)).limit(1);
  if (!header) throw new AppError('Sale not found.', 404);
  const [items, payments] = await Promise.all([
    db.select({
      barcode: stock.barcode,
      discountAmount: saleItems.discountAmount,
      id: saleItems.id,
      productId: saleItems.productId,
      productName: products.name,
      productSku: products.sku,
      quantity: saleItems.quantity,
      stockId: stock.id,
      totalAmount: saleItems.totalAmount,
      unitPrice: saleItems.unitPrice,
    }).from(saleItems)
      .innerJoin(products, eq(products.id, saleItems.productId))
      .leftJoin(saleItemStock, eq(saleItemStock.saleItemId, saleItems.id))
      .leftJoin(stock, eq(stock.id, saleItemStock.stockId))
      .where(eq(saleItems.saleId, id)).orderBy(saleItems.id, stock.id),
    db.select({
      amount: salePayments.amount,
      id: salePayments.id,
      method: salePayments.method,
      receivedBy: salePayments.receivedBy,
      referenceNo: salePayments.referenceNo,
      timestamp: salePayments.timestamp,
    }).from(salePayments).where(eq(salePayments.saleId, id)).orderBy(salePayments.id),
  ]);
  const groupedItems = [...items.reduce((map, row) => {
    const item = map.get(row.id) ?? {
      discountAmount: row.discountAmount,
      id: row.id,
      productId: row.productId,
      productName: row.productName,
      productSku: row.productSku,
      quantity: row.quantity,
      stockUnits: [] as Array<{ barcode: string | null; stockId: number | null }>,
      totalAmount: row.totalAmount,
      unitPrice: row.unitPrice,
    };
    if (row.stockId) item.stockUnits.push({ barcode: row.barcode, stockId: row.stockId });
    map.set(row.id, item);
    return map;
  }, new Map<number, {
    discountAmount: string; id: number; productId: number; productName: string; productSku: string | null;
    quantity: number; stockUnits: Array<{ barcode: string | null; stockId: number | null }>; totalAmount: string; unitPrice: string;
  }>()).values()];
  return { ...header, items: groupedItems, payments };
};

export const listSales = async (input: unknown) => {
  const query = listSalesSchema.parse(input);
  const filters: SQL[] = [];
  if (query.status !== 'all') filters.push(eq(sales.status, query.status));
  if (query.fromDate) filters.push(sql`${sales.timestamp} >= ${startOfColomboDate(query.fromDate)}`);
  if (query.toDate) filters.push(sql`${sales.timestamp} <= ${endOfColomboDate(query.toDate)}`);
  if (query.search) {
    const condition = or(
      like(sales.invoiceNo, `%${query.search}%`),
      like(customers.name, `%${query.search}%`),
      like(customers.phone, `%${query.search}%`),
    );
    if (condition) filters.push(condition);
  }
  const where = filters.length ? and(...filters) : undefined;
  const offset = (query.page - 1) * query.pageSize;
  const [items, [{ total }]] = await Promise.all([
    db.select({
      customerId: sales.customerId,
      customerName: customers.name,
      discountAmount: sales.discountAmount,
      id: sales.id,
      invoiceNo: sales.invoiceNo,
      locationName: locations.name,
      paidAmount: sales.paidAmount,
      status: sales.status,
      timestamp: sales.timestamp,
      totalAmount: sales.totalAmount,
      userName: users.displayName,
    }).from(sales)
      .leftJoin(customers, eq(customers.id, sales.customerId))
      .innerJoin(locations, eq(locations.id, sales.locationId))
      .innerJoin(users, eq(users.id, sales.userId))
      .where(where).orderBy(desc(sales.id)).limit(query.pageSize).offset(offset),
    db.select({ total: count() }).from(sales).leftJoin(customers, eq(customers.id, sales.customerId)).where(where),
  ]);
  return { items, pagination: { page: query.page, pageSize: query.pageSize, total: Number(total), totalPages: Math.ceil(Number(total) / query.pageSize) } };
};

export const dailySummary = async (input: unknown) => {
  const query = dailySalesSummarySchema.parse(input);
  const fromMs = startOfColomboDate(query.fromDate);
  const toMs = endOfColomboDate(query.toDate);
  if (fromMs > toMs) throw new AppError('From date cannot be after to date.', 400);
  if (toMs - fromMs > 370 * 24 * 60 * 60 * 1000) throw new AppError('Date range cannot be longer than 370 days.', 400);

  const rows = await db.select({
    discountAmount: sales.discountAmount,
    paidAmount: sales.paidAmount,
    status: sales.status,
    timestamp: sales.timestamp,
    totalAmount: sales.totalAmount,
  }).from(sales).where(and(
    eq(sales.status, 'completed'),
    sql`${sales.timestamp} >= ${fromMs}`,
    sql`${sales.timestamp} <= ${toMs}`,
  )).orderBy(sales.timestamp);

  const byDate = new Map(eachColomboDate(query.fromDate, query.toDate).map((date) => [date, {
    date,
    discountAmount: 0,
    paidAmount: 0,
    saleCount: 0,
    totalAmount: 0,
  }]));

  for (const row of rows) {
    const date = colomboDayKey(Number(row.timestamp));
    const summary = byDate.get(date);
    if (!summary) continue;
    summary.saleCount += 1;
    summary.totalAmount = money(summary.totalAmount + Number(row.totalAmount));
    summary.discountAmount = money(summary.discountAmount + Number(row.discountAmount));
    summary.paidAmount = money(summary.paidAmount + Number(row.paidAmount));
  }

  const items = [...byDate.values()];
  return {
    items,
    totals: items.reduce((total, item) => ({
      discountAmount: money(total.discountAmount + item.discountAmount),
      paidAmount: money(total.paidAmount + item.paidAmount),
      saleCount: total.saleCount + item.saleCount,
      totalAmount: money(total.totalAmount + item.totalAmount),
    }), { discountAmount: 0, paidAmount: 0, saleCount: 0, totalAmount: 0 }),
  };
};

export const getSale = async (input: unknown) => saleDetail(saleIdSchema.parse(input));

// Search
export const searchProducts = async (input: unknown, user: AuthenticatedUser) => {
  const query = searchSaleProductsSchema.parse(input);
  if (!user.defaultLocationId) throw new AppError('Your account does not have an assigned sale location.', 400);
  const saleLocationId = user.defaultLocationId;
  const statusId = await findStatusId(STOCK_STATUS.AVAILABLE);
  const barcodeRows = await db.select({
    barcode: stock.barcode,
    locationId: stock.locationId,
    locationName: locations.name,
    mrpPrice: products.mrpPrice,
    productId: stock.productId,
    productName: products.name,
    productSku: products.sku,
    sellingPrice: products.lowestSellingPrice,
    stockId: stock.id,
  }).from(stock)
    .innerJoin(products, eq(products.id, stock.productId))
    .leftJoin(locations, eq(locations.id, stock.locationId))
    .where(and(
      eq(stock.status, statusId),
      eq(stock.locationId, saleLocationId),
      eq(stock.barcode, query.search),
    )).limit(1);
  if (barcodeRows.length) {
    return barcodeRows.map((row) => ({ ...row, matchType: 'barcode' as const, quantityAvailable: 1, stockIds: [row.stockId] }));
  }
  const identifierRows = await db.select({
    barcode: stock.barcode,
    locationId: stock.locationId,
    locationName: locations.name,
    matchType: stockIdentifiers.type,
    mrpPrice: products.mrpPrice,
    productId: stock.productId,
    productName: products.name,
    productSku: products.sku,
    sellingPrice: products.lowestSellingPrice,
    stockId: stock.id,
  }).from(stockIdentifiers)
    .innerJoin(stock, eq(stock.id, stockIdentifiers.stockId))
    .innerJoin(products, eq(products.id, stock.productId))
    .leftJoin(locations, eq(locations.id, stock.locationId))
    .where(and(
      eq(stock.status, statusId),
      eq(stock.locationId, saleLocationId),
      eq(stockIdentifiers.value, query.search),
    )).limit(1);
  if (identifierRows.length) {
    return identifierRows.map((row) => ({ ...row, quantityAvailable: 1, stockIds: [row.stockId] }));
  }
  const filters = [
    eq(stock.status, statusId),
    eq(stock.locationId, saleLocationId),
    or(like(products.name, `%${query.search}%`), like(products.sku, `%${query.search}%`)),
  ].filter((condition): condition is SQL => Boolean(condition));
  const rows = await db.select({
    locationId: stock.locationId,
    locationName: locations.name,
    mrpPrice: products.mrpPrice,
    productId: products.id,
    productName: products.name,
    productSku: products.sku,
    quantityAvailable: count(stock.id),
    sellingPrice: products.lowestSellingPrice,
    stockIds: sql<string>`group_concat(${stock.id} order by ${stock.id} asc separator ',')`,
  }).from(stock)
    .innerJoin(products, eq(products.id, stock.productId))
    .leftJoin(locations, eq(locations.id, stock.locationId))
    .where(and(...filters))
    .groupBy(products.id, products.name, products.sku, products.lowestSellingPrice, products.mrpPrice, stock.locationId, locations.name)
    .orderBy(products.name, locations.name).limit(20);
  return rows.map((row) => ({
    ...row,
    matchType: 'product' as const,
    quantityAvailable: Number(row.quantityAvailable),
    stockIds: row.stockIds ? row.stockIds.split(',').map((id) => Number(id)) : [],
  }));
};

export const searchCustomers = async (input: unknown) => {
  const query = searchSaleCustomersSchema.parse(input);
  return db.select({
    email: customers.email,
    id: customers.id,
    name: customers.name,
    phone: customers.phone,
  }).from(customers)
    .where(and(eq(customers.isActive, true), or(like(customers.phone, `%${query.search}%`), like(customers.name, `%${query.search}%`))))
    .orderBy(customers.name).limit(10);
};

export const createSale = async (input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const data = createSaleSchema.parse(input);
  if (!user.defaultLocationId) throw new AppError('Your account does not have an assigned sale location.', 400);
  const saleLocationId = user.defaultLocationId;
  const requestedStockIds = data.items.flatMap((item) => item.stockIds);
  if (new Set(requestedStockIds).size !== requestedStockIds.length) throw new AppError('A stock unit cannot be sold twice in the same sale.', 400);

  const createdSaleId = await db.transaction(async (transaction) => {
    const soldStatusId = await findStatusId(STOCK_STATUS.SOLD);
    const availableStatusId = await findStatusId(STOCK_STATUS.AVAILABLE);
    const selectedStock = requestedStockIds.length ? await transaction.select({
      id: stock.id,
      locationId: stock.locationId,
      productId: stock.productId,
      status: stock.status,
    }).from(stock).where(inArray(stock.id, requestedStockIds)).for('update') : [];
    if (selectedStock.length !== requestedStockIds.length) throw new AppError('One or more selected stock units were not found.', 404);
    for (const unit of selectedStock) {
      if (unit.status !== availableStatusId) throw new AppError('One or more selected stock units are not available for sale.', 409);
      if (unit.locationId !== saleLocationId) throw new AppError('One or more selected stock units do not belong to your assigned sale location.', 409);
    }
    const stockByProduct = selectedStock.reduce((map, unit) => {
      const list = map.get(unit.productId ?? 0) ?? [];
      list.push(unit.id);
      map.set(unit.productId ?? 0, list);
      return map;
    }, new Map<number, number[]>());
    for (const item of data.items) {
      if (item.stockIds.length !== item.quantity) throw new AppError('Selected stock unit count must match item quantity.', 400);
      const availableForProduct = stockByProduct.get(item.productId) ?? [];
      if (availableForProduct.length < item.quantity) throw new AppError('Selected stock units do not match the sale product.', 400);
    }

    let customerId = data.customer?.id ?? null;
    if (!customerId && data.customer?.phone) {
      const [existing] = await transaction.select({ id: customers.id }).from(customers).where(eq(customers.phone, data.customer.phone)).limit(1);
      customerId = existing?.id ?? null;
    }
    if (!customerId && data.customer?.name && data.customer?.phone) {
      const result = await transaction.insert(customers).values({
        isActive: true,
        name: data.customer.name,
        phone: data.customer.phone,
        timestamp: Date.now(),
      });
      customerId = Number(result[0].insertId);
    }

    const invoiceNo = await ensureInvoiceNumber(transaction, saleLocationId);
    const itemTotals = data.items.map((item) => money(item.unitPrice * item.quantity - item.discountAmount));
    const subTotal = money(data.items.reduce((total, item) => total + (item.unitPrice * item.quantity), 0));
    const itemDiscountTotal = money(data.items.reduce((total, item) => total + item.discountAmount, 0));
    const totalAmount = money(Math.max(0, subTotal - itemDiscountTotal - data.discountAmount));
    if (data.payment.amount < totalAmount) throw new AppError('Paid amount cannot be less than sale total.', 400);

    const timestamp = Date.now();
    const result = await transaction.insert(sales).values({
      customerId,
      discountAmount: String(data.discountAmount),
      invoiceNo,
      locationId: saleLocationId,
      paidAmount: String(data.payment.amount),
      status: 'completed',
      subTotal: String(subTotal),
      timestamp,
      totalAmount: String(totalAmount),
      userId: user.id,
    });
    const saleId = Number(result[0].insertId);
    for (const [index, item] of data.items.entries()) {
      const itemResult = await transaction.insert(saleItems).values({
        discountAmount: String(item.discountAmount),
        productId: item.productId,
        quantity: item.quantity,
        saleId,
        totalAmount: String(itemTotals[index]),
        unitPrice: String(item.unitPrice),
      });
      const saleItemId = Number(itemResult[0].insertId);
      await transaction.insert(saleItemStock).values(item.stockIds.map((stockId) => ({ saleItemId, stockId, timestamp })));
      await transaction.update(stock).set({ status: soldStatusId }).where(inArray(stock.id, item.stockIds));
    }
    await transaction.insert(salePayments).values({
      amount: String(data.payment.amount),
      method: data.payment.method,
      receivedBy: user.id,
      referenceNo: data.payment.referenceNo || null,
      saleId,
      timestamp,
    });
    await transaction.insert(auditLogs).values({
      action: 'create',
      entityId: saleId,
      entityType: 'sale',
      ipAddress: context.ipAddress,
      module: 'sales',
      newValues: { invoiceNo, totalAmount },
      timestamp,
      userId: user.id,
    });
    return saleId;
  });
  return saleDetail(createdSaleId);
};
