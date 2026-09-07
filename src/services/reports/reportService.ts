import { and, asc, count, desc, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';

import { db } from '../../db';
import { grns, locations, products, repairJobs, saleItems, salePayments, sales, stock, stockStatuses, suppliers } from '../../db/schema';
import { reportQuerySchema, type ReportQuery } from './reportValidation';
import type { AuthenticatedUser } from '../auth/authService';
import { resolveLocationScope } from '../shared/locationAccess';

const money = (value: unknown) => Number(value ?? 0);
const DAY_MS = 86_400_000;
const COLOMBO_OFFSET_MS = 19_800_000;

const dayStart = (date: string) => new Date(`${date}T00:00:00.000+05:30`).getTime();
const dayEnd = (date: string) => new Date(`${date}T23:59:59.999+05:30`).getTime();

const dateFilters = (timestamp: SQL.Aliased | any, query: ReportQuery): SQL[] => [
  ...(query.fromDate ? [gte(timestamp, dayStart(query.fromDate))] : []),
  ...(query.toDate ? [lte(timestamp, dayEnd(query.toDate))] : []),
];

const locationFilter = (column: SQL.Aliased | any, query: ReportQuery): SQL[] =>
  query.locationId === 'all' ? [] : [eq(column, query.locationId)];

const parseQuery = (input: unknown) => reportQuerySchema.parse(input);

const scopedQuery = async (input: unknown, user: AuthenticatedUser): Promise<ReportQuery> => {
  const query = parseQuery(input);
  return { ...query, locationId: await resolveLocationScope(query.locationId, user) };
};

export const salesReport = async (input: unknown, user: AuthenticatedUser) => {
  const query = await scopedQuery(input, user);
  const where = and(eq(sales.status, 'completed'), ...dateFilters(sales.timestamp, query), ...locationFilter(sales.locationId, query));
  const dayBucket = sql<number>`floor((${sales.timestamp} + ${COLOMBO_OFFSET_MS}) / ${DAY_MS})`;
  const [summaryRows, paymentRows, topProducts, rows] = await Promise.all([
    db.select({
      discountAmount: sql<string>`coalesce(sum(${sales.discountAmount}), 0)`,
      paidAmount: sql<string>`coalesce(sum(${sales.paidAmount}), 0)`,
      saleCount: count(),
      subTotal: sql<string>`coalesce(sum(${sales.subTotal}), 0)`,
      totalAmount: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`,
    }).from(sales).where(where),
    db.select({ method: salePayments.method, total: sql<string>`coalesce(sum(${salePayments.amount}), 0)` })
      .from(salePayments)
      .innerJoin(sales, eq(sales.id, salePayments.saleId))
      .where(where)
      .groupBy(salePayments.method),
    db.select({
      productName: products.name,
      quantity: sql<number>`coalesce(sum(${saleItems.quantity}), 0)`,
      totalAmount: sql<string>`coalesce(sum(${saleItems.totalAmount}), 0)`,
    }).from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .innerJoin(products, eq(products.id, saleItems.productId))
      .where(where)
      .groupBy(products.id, products.name)
      .orderBy(desc(sql`sum(${saleItems.totalAmount})`))
      .limit(10),
    db.select({
      bucket: dayBucket,
      discountAmount: sql<string>`coalesce(sum(${sales.discountAmount}), 0)`,
      paidAmount: sql<string>`coalesce(sum(${sales.paidAmount}), 0)`,
      saleCount: count(),
      totalAmount: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`,
    }).from(sales).where(where).groupBy(dayBucket).orderBy(asc(dayBucket)),
  ]);
  const summary = summaryRows[0] ?? { discountAmount: 0, paidAmount: 0, saleCount: 0, subTotal: 0, totalAmount: 0 };
  return {
    rows: rows.map(({ bucket, ...row }) => ({
      ...row,
      date: new Date(Number(bucket) * DAY_MS).toISOString().slice(0, 10),
      discountAmount: money(row.discountAmount),
      paidAmount: money(row.paidAmount),
      totalAmount: money(row.totalAmount),
    })),
    summary: {
      discountAmount: money(summary.discountAmount),
      paidAmount: money(summary.paidAmount),
      paymentTotals: Object.fromEntries(paymentRows.map((row) => [row.method, money(row.total)])),
      saleCount: Number(summary.saleCount),
      subTotal: money(summary.subTotal),
      topProducts: topProducts.map((row) => ({ ...row, quantity: Number(row.quantity), totalAmount: money(row.totalAmount) })),
      totalAmount: money(summary.totalAmount),
    },
  };
};

export const inventoryReport = async (input: unknown, user: AuthenticatedUser) => {
  const query = await scopedQuery(input, user);
  const where = and(...locationFilter(stock.locationId, query));
  const [summaryRows, byStatus, rows] = await Promise.all([
    db.select({
      costValue: sql<string>`coalesce(sum(${stock.costPrice}), 0)`,
      mrpValue: sql<string>`coalesce(sum(coalesce(${stock.maxRetailPrice}, ${products.mrpPrice})), 0)`,
      units: count(),
    }).from(stock).leftJoin(products, eq(products.id, stock.productId)).where(where),
    db.select({ status: stockStatuses.label, units: count() })
      .from(stock).leftJoin(stockStatuses, eq(stockStatuses.id, stock.status)).where(where).groupBy(stockStatuses.label),
    db.select({
      avgCost: sql<string>`coalesce(avg(${stock.costPrice}), 0)`,
      locationName: locations.name,
      mrpValue: sql<string>`coalesce(sum(coalesce(${stock.maxRetailPrice}, ${products.mrpPrice})), 0)`,
      productName: products.name,
      status: stockStatuses.label,
      units: count(),
      valueAtCost: sql<string>`coalesce(sum(${stock.costPrice}), 0)`,
    }).from(stock)
      .leftJoin(products, eq(products.id, stock.productId))
      .leftJoin(locations, eq(locations.id, stock.locationId))
      .leftJoin(stockStatuses, eq(stockStatuses.id, stock.status))
      .where(where)
      .groupBy(products.id, products.name, locations.name, stockStatuses.label)
      .orderBy(asc(products.name))
      .limit(500),
  ]);
  const summary = summaryRows[0] ?? { costValue: 0, mrpValue: 0, units: 0 };
  return {
    rows: rows.map((row) => ({ ...row, avgCost: money(row.avgCost), mrpValue: money(row.mrpValue), units: Number(row.units), valueAtCost: money(row.valueAtCost) })),
    summary: { costValue: money(summary.costValue), mrpValue: money(summary.mrpValue), statusTotals: byStatus.map((row) => ({ status: row.status ?? 'Unknown', units: Number(row.units) })), units: Number(summary.units) },
  };
};

export const purchasingReport = async (input: unknown, user: AuthenticatedUser) => {
  const query = await scopedQuery(input, user);
  const where = and(...dateFilters(grns.timestamp, query), ...locationFilter(grns.locationId, query));
  const [summaryRows, byStatus, rows] = await Promise.all([
    db.select({
      costTotal: sql<string>`coalesce(sum(${grns.costTotal}), 0)`,
      grnCount: count(),
      paidAmount: sql<string>`coalesce(sum(${grns.paidAmount}), 0)`,
    }).from(grns).where(where),
    db.select({ status: grns.status, total: count() }).from(grns).where(where).groupBy(grns.status),
    db.select({
      costTotal: grns.costTotal,
      grnNumber: grns.grnNumber,
      locationName: locations.name,
      paidAmount: grns.paidAmount,
      paymentStatus: grns.paymentStatus,
      status: grns.status,
      supplierName: suppliers.name,
      timestamp: grns.timestamp,
    }).from(grns)
      .innerJoin(locations, eq(locations.id, grns.locationId))
      .innerJoin(suppliers, eq(suppliers.id, grns.supplierId))
      .where(where)
      .orderBy(desc(grns.timestamp))
      .limit(500),
  ]);
  const summary = summaryRows[0] ?? { costTotal: 0, grnCount: 0, paidAmount: 0 };
  return {
    rows: rows.map((row) => ({ ...row, costTotal: money(row.costTotal), paidAmount: money(row.paidAmount) })),
    summary: { balanceAmount: money(summary.costTotal) - money(summary.paidAmount), costTotal: money(summary.costTotal), grnCount: Number(summary.grnCount), paidAmount: money(summary.paidAmount), statusTotals: byStatus.map((row) => ({ status: row.status, total: Number(row.total) })) },
  };
};

export const repairsReport = async (input: unknown, user: AuthenticatedUser) => {
  const query = await scopedQuery(input, user);
  const where = and(...dateFilters(repairJobs.timestamp, query), ...locationFilter(repairJobs.locationId, query));
  const [summaryRows, byStatus, rows] = await Promise.all([
    db.select({
      estimatedCost: sql<string>`coalesce(sum(${repairJobs.estimatedCost}), 0)`,
      finalCost: sql<string>`coalesce(sum(${repairJobs.finalCost}), 0)`,
      repairCount: count(),
    }).from(repairJobs).where(where),
    db.select({ status: repairJobs.status, total: count() }).from(repairJobs).where(where).groupBy(repairJobs.status),
    db.select({
      deviceName: repairJobs.deviceName,
      estimatedCost: repairJobs.estimatedCost,
      finalCost: repairJobs.finalCost,
      jobNo: repairJobs.jobNo,
      locationName: locations.name,
      serialImei: repairJobs.serialImei,
      status: repairJobs.status,
      timestamp: repairJobs.timestamp,
    }).from(repairJobs).innerJoin(locations, eq(locations.id, repairJobs.locationId)).where(where).orderBy(desc(repairJobs.timestamp)).limit(500),
  ]);
  const summary = summaryRows[0] ?? { estimatedCost: 0, finalCost: 0, repairCount: 0 };
  return {
    rows: rows.map((row) => ({ ...row, estimatedCost: money(row.estimatedCost), finalCost: money(row.finalCost) })),
    summary: { estimatedCost: money(summary.estimatedCost), finalCost: money(summary.finalCost), repairCount: Number(summary.repairCount), statusTotals: byStatus.map((row) => ({ status: row.status, total: Number(row.total) })) },
  };
};
