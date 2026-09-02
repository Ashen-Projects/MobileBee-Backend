import { and, count, desc, eq, inArray, like, or, sql, type SQL } from 'drizzle-orm';

import { db } from '../../../db';
import { grnItems, grns, locations, products, stock, stockIdentifiers, stockStatuses, suppliers } from '../../../db/schema';
import { listPendingStockReceiptsSchema, listStockSchema } from './stockValidation';

const stockFilters = async (query: ReturnType<typeof listStockSchema.parse>) => {
  const filters: SQL[] = [];
  if (query.locationId !== 'all') filters.push(eq(stock.locationId, query.locationId));
  if (query.statusId !== 'all') filters.push(eq(stock.status, query.statusId));
  if (query.search) {
    const identifiers = await db.select({ stockId: stockIdentifiers.stockId }).from(stockIdentifiers)
      .where(like(stockIdentifiers.value, `%${query.search}%`));
    const searchable = [
      like(stock.barcode, `%${query.search}%`),
      like(products.name, `%${query.search}%`),
      like(products.sku, `%${query.search}%`),
    ];
    if (identifiers.length) searchable.push(inArray(stock.id, identifiers.map(({ stockId }) => stockId)));
    const condition = or(...searchable.filter((item): item is NonNullable<typeof item> => item !== undefined));
    if (condition) filters.push(condition);
  }
  return filters;
};

const getPendingRows = async (locationId: number | 'all' = 'all', search = '') => {
  const filters: SQL[] = [eq(grns.status, 'approved')];
  if (locationId !== 'all') filters.push(eq(grns.locationId, locationId));
  if (search) {
    const searchable = [like(grns.grnNumber, `%${search}%`), like(suppliers.name, `%${search}%`), like(suppliers.code, `%${search}%`)]
      .filter((condition): condition is NonNullable<typeof condition> => condition !== undefined);
    const condition = or(...searchable);
    if (condition) filters.push(condition);
  }
  return db.select({
    grnId: grns.id,
    grnNumber: grns.grnNumber,
    locationId: grns.locationId,
    locationName: locations.name,
    quantity: grnItems.quantity,
    stockedQuantity: grnItems.stockedQuantity,
    supplierCode: suppliers.code,
    supplierId: suppliers.id,
    supplierName: suppliers.name,
    timestamp: grns.timestamp,
  }).from(grns)
    .innerJoin(grnItems, eq(grnItems.grnId, grns.id))
    .innerJoin(locations, eq(locations.id, grns.locationId))
    .innerJoin(suppliers, eq(suppliers.id, grns.supplierId))
    .where(and(...filters))
    .orderBy(desc(grns.id), desc(grnItems.id));
};

export const listStock = async (input: unknown) => {
  const query = listStockSchema.parse(input);
  const filters = await stockFilters(query);
  const where = filters.length ? and(...filters) : undefined;
  const offset = (query.page - 1) * query.pageSize;
  const base = db.select({
    barcode: stock.barcode,
    costPrice: stock.costPrice,
    grnId: stock.grnId,
    grnNumber: grns.grnNumber,
    id: stock.id,
    locationId: stock.locationId,
    locationName: locations.name,
    productId: stock.productId,
    productName: products.name,
    productSku: products.sku,
    statusId: stock.status,
    statusLabel: stockStatuses.label,
    statusName: stockStatuses.name,
    timestamp: stock.timestamp,
  }).from(stock)
    .leftJoin(products, eq(products.id, stock.productId))
    .leftJoin(locations, eq(locations.id, stock.locationId))
    .leftJoin(stockStatuses, eq(stockStatuses.id, stock.status))
    .leftJoin(grns, eq(grns.id, stock.grnId));
  const [rows, [{ total }]] = await Promise.all([
    base.where(where).orderBy(desc(stock.id)).limit(query.pageSize).offset(offset),
    db.select({ total: count() }).from(stock)
      .leftJoin(products, eq(products.id, stock.productId)).where(where),
  ]);
  const identifiers = rows.length
    ? await db.select({ id: stockIdentifiers.id, isPrimary: stockIdentifiers.isPrimary, stockId: stockIdentifiers.stockId, type: stockIdentifiers.type, value: stockIdentifiers.value })
      .from(stockIdentifiers).where(inArray(stockIdentifiers.stockId, rows.map(({ id }) => id))).orderBy(stockIdentifiers.id)
    : [];
  const identifiersByStock = identifiers.reduce((map, identifier) => {
    const values = map.get(identifier.stockId) ?? [];
    values.push(identifier);
    map.set(identifier.stockId, values);
    return map;
  }, new Map<number, typeof identifiers>());
  return {
    items: rows.map((row) => ({ ...row, identifiers: identifiersByStock.get(row.id) ?? [] })),
    pagination: { page: query.page, pageSize: query.pageSize, total: Number(total), totalPages: Math.ceil(Number(total) / query.pageSize) },
  };
};

export const getStockOverview = async () => {
  const [statusRows, locationRows, pendingRows] = await Promise.all([
    db.select({
      count: sql<number>`count(${stock.id})`,
      isSellable: stockStatuses.isSellable,
      statusId: stockStatuses.id,
      statusLabel: stockStatuses.label,
      statusName: stockStatuses.name,
    }).from(stock).leftJoin(stockStatuses, eq(stockStatuses.id, stock.status))
      .groupBy(stockStatuses.id, stockStatuses.name, stockStatuses.label, stockStatuses.isSellable)
      .orderBy(stockStatuses.label),
    db.select({ count: sql<number>`count(${stock.id})`, locationId: locations.id, locationName: locations.name })
      .from(stock).leftJoin(locations, eq(locations.id, stock.locationId))
      .groupBy(locations.id, locations.name).orderBy(locations.name),
    getPendingRows(),
  ]);
  const totalUnits = statusRows.reduce((total, row) => total + Number(row.count), 0);
  const sellableUnits = statusRows.reduce((total, row) => total + (row.isSellable ? Number(row.count) : 0), 0);
  const pendingStockUnits = pendingRows.reduce((total, row) => total + Math.max(0, row.quantity - row.stockedQuantity), 0);
  return {
    locations: locationRows.map((row) => ({ ...row, count: Number(row.count) })),
    pendingStockUnits,
    pendingReceiptCount: new Set(pendingRows.filter((row) => row.quantity > row.stockedQuantity).map((row) => row.grnId)).size,
    sellableUnits,
    statuses: statusRows.map((row) => ({ ...row, count: Number(row.count) })),
    totalUnits,
    unavailableUnits: totalUnits - sellableUnits,
  };
};

export const listPendingStockReceipts = async (input: unknown) => {
  const query = listPendingStockReceiptsSchema.parse(input);
  const rows = await getPendingRows(query.locationId, query.search);
  const grouped = rows.reduce((map, row) => {
    const receipt = map.get(row.grnId) ?? {
      grnId: row.grnId,
      grnNumber: row.grnNumber,
      locationId: row.locationId,
      locationName: row.locationName,
      remainingQuantity: 0,
      supplierCode: row.supplierCode,
      supplierId: row.supplierId,
      supplierName: row.supplierName,
      timestamp: row.timestamp,
      totalQuantity: 0,
    };
    receipt.totalQuantity += row.quantity;
    receipt.remainingQuantity += Math.max(0, row.quantity - row.stockedQuantity);
    map.set(row.grnId, receipt);
    return map;
  }, new Map<number, {
    grnId: number; grnNumber: string; locationId: number; locationName: string; remainingQuantity: number;
    supplierCode: string; supplierId: number; supplierName: string; timestamp: number; totalQuantity: number;
  }>());
  const items = [...grouped.values()].filter((receipt) => receipt.remainingQuantity > 0);
  const offset = (query.page - 1) * query.pageSize;
  return {
    items: items.slice(offset, offset + query.pageSize),
    pagination: { page: query.page, pageSize: query.pageSize, total: items.length, totalPages: Math.ceil(items.length / query.pageSize) },
  };
};

export const listStockStatuses = async () => db.select({ id: stockStatuses.id, isSellable: stockStatuses.isSellable, label: stockStatuses.label, name: stockStatuses.name })
  .from(stockStatuses).where(eq(stockStatuses.isActive, true)).orderBy(stockStatuses.label);
