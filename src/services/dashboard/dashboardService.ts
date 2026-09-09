import { and, asc, count, desc, eq, gt, inArray, lte, sql, type SQL } from 'drizzle-orm';

import { db } from '../../db';
import {
  customers,
  grns,
  locations,
  posDrawers,
  productLocationStockLevels,
  products,
  repairJobs,
  saleItems,
  saleItemStock,
  salePayments,
  sales,
  stock,
  stockStatuses,
} from '../../db/schema';
import { AppError } from '../../errors/app-error';
import { STOCK_STATUS, USER_PERMISSIONS } from '../../utils/constants';
import type { AuthenticatedUser } from '../auth/authService';
import { isAdministrator, resolveLocationScope, type LocationScope } from '../shared/locationAccess';
import { getDashboardInsights } from './dashboardInsightService';
import { getDashboardForecast } from './dashboardForecastService';
import { dashboardQuerySchema } from './dashboardValidation';

const DAY_MS = 86_400_000;
const COLOMBO_OFFSET_MS = 19_800_000;
const money = (value: unknown) => Number(Number(value ?? 0).toFixed(2));
const dateAtUtc = (value: string) => Date.parse(`${value}T00:00:00.000Z`);
const addDays = (value: string, days: number) => new Date(dateAtUtc(value) + days * DAY_MS).toISOString().slice(0, 10);
const dayStart = (date: string) => new Date(`${date}T00:00:00.000+05:30`).getTime();
const dayEnd = (date: string) => new Date(`${date}T23:59:59.999+05:30`).getTime();
const todayInColombo = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: '2-digit', timeZone: 'Asia/Colombo', year: 'numeric',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${value.year}-${value.month}-${value.day}`;
};
const hasPermission = (user: AuthenticatedUser, permission: string) =>
  isAdministrator(user) || user.permissions.includes(permission);
const resolveDashboardLocationScope = async (
  requestedLocationId: number | 'all',
  user: AuthenticatedUser,
  canViewAllLocations: boolean,
): Promise<LocationScope> => {
  if (!canViewAllLocations) return resolveLocationScope(requestedLocationId, user);
  if (requestedLocationId === 'all') return 'all';

  const [location] = await db.select({ id: locations.id }).from(locations)
    .where(and(eq(locations.id, requestedLocationId), eq(locations.isActive, true)))
    .limit(1);
  if (!location) throw new AppError('The selected dashboard location is unavailable.', 404);
  return location.id;
};
const locationFilters = (column: SQL.Aliased | any, scope: LocationScope): SQL[] =>
  scope === 'all' ? [] : [eq(column, scope)];
const percentageChange = (current: number, previous: number) => {
  if (previous === 0) return current === 0 ? 0 : null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

const salesSection = async (fromDate: string, toDate: string, scope: LocationScope, includeFinancials: boolean) => {
  const days = Math.floor((dateAtUtc(toDate) - dateAtUtc(fromDate)) / DAY_MS) + 1;
  const previousToDate = addDays(fromDate, -1);
  const previousFromDate = addDays(fromDate, -days);
  const currentWhere = and(
    eq(sales.status, 'completed'),
    sql`${sales.timestamp} >= ${dayStart(fromDate)}`,
    lte(sales.timestamp, dayEnd(toDate)),
    ...locationFilters(sales.locationId, scope),
  );
  const previousWhere = and(
    eq(sales.status, 'completed'),
    sql`${sales.timestamp} >= ${dayStart(previousFromDate)}`,
    lte(sales.timestamp, dayEnd(previousToDate)),
    ...locationFilters(sales.locationId, scope),
  );
  const dayBucket = sql<number>`floor((${sales.timestamp} + ${COLOMBO_OFFSET_MS}) / ${DAY_MS})`;

  const [summaryRows, previousRows, dailyRows, paymentRows, topProductRows, costRows] = await Promise.all([
    db.select({
      discountAmount: sql<string>`coalesce(sum(${sales.discountAmount}), 0)`,
      paidAmount: sql<string>`coalesce(sum(${sales.paidAmount}), 0)`,
      saleCount: count(),
      totalAmount: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`,
    }).from(sales).where(currentWhere),
    db.select({ totalAmount: sql<string>`coalesce(sum(${sales.totalAmount}), 0)` }).from(sales).where(previousWhere),
    db.select({
      bucket: dayBucket,
      saleCount: count(),
      totalAmount: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`,
    }).from(sales).where(currentWhere).groupBy(dayBucket).orderBy(asc(dayBucket)),
    db.select({ method: salePayments.method, total: sql<string>`coalesce(sum(${salePayments.amount}), 0)` })
      .from(salePayments).innerJoin(sales, eq(sales.id, salePayments.saleId))
      .where(currentWhere).groupBy(salePayments.method),
    db.select({
      productId: products.id,
      productName: products.name,
      quantity: sql<number>`coalesce(sum(${saleItems.quantity}), 0)`,
      totalAmount: sql<string>`coalesce(sum(${saleItems.totalAmount}), 0)`,
    }).from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .innerJoin(products, eq(products.id, saleItems.productId))
      .where(currentWhere)
      .groupBy(products.id, products.name)
      .orderBy(desc(sql`sum(${saleItems.totalAmount})`)).limit(8),
    includeFinancials
      ? db.select({ costOfGoods: sql<string>`coalesce(sum(${stock.costPrice}), 0)` })
        .from(saleItemStock)
        .innerJoin(saleItems, eq(saleItems.id, saleItemStock.saleItemId))
        .innerJoin(sales, eq(sales.id, saleItems.saleId))
        .innerJoin(stock, eq(stock.id, saleItemStock.stockId))
        .where(currentWhere)
      : Promise.resolve([{ costOfGoods: '0' }]),
  ]);

  const summary = summaryRows[0];
  const totalAmount = money(summary?.totalAmount);
  const costOfGoods = money(costRows[0]?.costOfGoods);
  const saleCount = Number(summary?.saleCount ?? 0);
  const dailyByBucket = new Map(dailyRows.map((row) => [Number(row.bucket), row]));
  const trend = Array.from({ length: days }, (_, index) => {
    const date = addDays(fromDate, index);
    const bucket = Math.floor((dateAtUtc(date) + COLOMBO_OFFSET_MS) / DAY_MS);
    const row = dailyByBucket.get(bucket);
    return { date, saleCount: Number(row?.saleCount ?? 0), totalAmount: money(row?.totalAmount) };
  });

  return {
    averageSale: saleCount ? money(totalAmount / saleCount) : 0,
    costOfGoods: includeFinancials ? costOfGoods : null,
    discountAmount: money(summary?.discountAmount),
    grossProfit: includeFinancials ? money(totalAmount - costOfGoods) : null,
    paidAmount: money(summary?.paidAmount),
    paymentTotals: Object.fromEntries(paymentRows.map((row) => [row.method, money(row.total)])),
    previousPeriod: { fromDate: previousFromDate, toDate: previousToDate, totalAmount: money(previousRows[0]?.totalAmount) },
    saleCount,
    topProducts: topProductRows.map((row) => ({ ...row, quantity: Number(row.quantity), totalAmount: money(row.totalAmount) })),
    totalAmount,
    totalChangePercentage: percentageChange(totalAmount, money(previousRows[0]?.totalAmount)),
    trend,
  };
};

const inventorySection = async (scope: LocationScope, includeFinancials: boolean) => {
  const availableWhere = and(eq(stockStatuses.name, STOCK_STATUS.AVAILABLE), ...locationFilters(stock.locationId, scope));
  const availableByProductLocation = db.select({
    locationId: stock.locationId,
    productId: stock.productId,
    units: count().as('units'),
  }).from(stock).innerJoin(stockStatuses, eq(stockStatuses.id, stock.status))
    .where(eq(stockStatuses.name, STOCK_STATUS.AVAILABLE))
    .groupBy(stock.productId, stock.locationId).as('available_by_product_location');

  const [summaryRows, configuredAlerts] = await Promise.all([
    db.select({
      costValue: sql<string>`coalesce(sum(${stock.costPrice}), 0)`,
      mrpValue: sql<string>`coalesce(sum(coalesce(${stock.maxRetailPrice}, ${products.mrpPrice})), 0)`,
      units: count(),
    }).from(stock)
      .innerJoin(stockStatuses, eq(stockStatuses.id, stock.status))
      .leftJoin(products, eq(products.id, stock.productId))
      .where(availableWhere),
    db.select({
      availableUnits: sql<number>`coalesce(${availableByProductLocation.units}, 0)`,
      locationId: locations.id,
      locationName: locations.name,
      minimumStockLevel: productLocationStockLevels.minimumStockLevel,
      productId: products.id,
      productName: products.name,
      sku: products.sku,
    }).from(productLocationStockLevels)
      .innerJoin(products, eq(products.id, productLocationStockLevels.productId))
      .innerJoin(locations, eq(locations.id, productLocationStockLevels.locationId))
      .leftJoin(availableByProductLocation, and(
        eq(availableByProductLocation.productId, productLocationStockLevels.productId),
        eq(availableByProductLocation.locationId, productLocationStockLevels.locationId),
      ))
      .where(and(
        eq(locations.isActive, true),
        eq(products.isActive, true),
        gt(productLocationStockLevels.minimumStockLevel, 0),
        sql`coalesce(${availableByProductLocation.units}, 0) <= ${productLocationStockLevels.minimumStockLevel}`,
        ...locationFilters(productLocationStockLevels.locationId, scope),
      ))
      .orderBy(asc(sql`coalesce(${availableByProductLocation.units}, 0)`), asc(products.name)),
  ]);
  const summary = summaryRows[0];
  const alerts = configuredAlerts.map((row) => ({ ...row, availableUnits: Number(row.availableUnits), minimumStockLevel: Number(row.minimumStockLevel) }));
  return {
    availableUnits: Number(summary?.units ?? 0),
    costValue: includeFinancials ? money(summary?.costValue) : null,
    lowStockCount: alerts.filter(({ availableUnits }) => availableUnits > 0).length,
    mrpValue: includeFinancials ? money(summary?.mrpValue) : null,
    outOfStockCount: alerts.filter(({ availableUnits }) => availableUnits === 0).length,
    stockAlerts: alerts.slice(0, 10),
  };
};

const repairsSection = async (fromDate: string, toDate: string, scope: LocationScope) => {
  const locationWhere = locationFilters(repairJobs.locationId, scope);
  const activeStatuses = ['received', 'inspection', 'waitingParts', 'inProgress'] as const;
  const [createdRows, statusRows, recentRows] = await Promise.all([
    db.select({ total: count() }).from(repairJobs).where(and(
      sql`${repairJobs.timestamp} >= ${dayStart(fromDate)}`,
      lte(repairJobs.timestamp, dayEnd(toDate)),
      ...locationWhere,
    )),
    db.select({ status: repairJobs.status, total: count() }).from(repairJobs)
      .where(and(inArray(repairJobs.status, activeStatuses), ...locationWhere))
      .groupBy(repairJobs.status),
    db.select({
      customerName: customers.name,
      deviceName: repairJobs.deviceName,
      jobNo: repairJobs.jobNo,
      locationName: locations.name,
      status: repairJobs.status,
      timestamp: repairJobs.timestamp,
    }).from(repairJobs)
      .innerJoin(customers, eq(customers.id, repairJobs.customerId))
      .innerJoin(locations, eq(locations.id, repairJobs.locationId))
      .where(and(inArray(repairJobs.status, activeStatuses), ...locationWhere))
      .orderBy(asc(repairJobs.timestamp)).limit(6),
  ]);
  const statuses = statusRows.map((row) => ({ status: row.status, total: Number(row.total) }));
  return {
    activeJobs: statuses.reduce((total, row) => total + row.total, 0),
    createdInRange: Number(createdRows[0]?.total ?? 0),
    oldestActiveJobs: recentRows,
    statusTotals: statuses,
  };
};

const purchasingSection = async (fromDate: string, toDate: string, scope: LocationScope, includeFinancials: boolean) => {
  const where = and(
    sql`${grns.timestamp} >= ${dayStart(fromDate)}`,
    lte(grns.timestamp, dayEnd(toDate)),
    ...locationFilters(grns.locationId, scope),
  );
  const [summaryRows, statusRows] = await Promise.all([
    db.select({
      costTotal: sql<string>`coalesce(sum(${grns.costTotal}), 0)`,
      grnCount: count(),
      paidAmount: sql<string>`coalesce(sum(${grns.paidAmount}), 0)`,
    }).from(grns).where(where),
    db.select({ status: grns.status, total: count() }).from(grns).where(where).groupBy(grns.status),
  ]);
  const summary = summaryRows[0];
  const costTotal = money(summary?.costTotal);
  const paidAmount = money(summary?.paidAmount);
  return {
    balanceAmount: includeFinancials ? money(costTotal - paidAmount) : null,
    costTotal: includeFinancials ? costTotal : null,
    grnCount: Number(summary?.grnCount ?? 0),
    paidAmount: includeFinancials ? paidAmount : null,
    statusTotals: statusRows.map((row) => ({ status: row.status, total: Number(row.total) })),
  };
};

const drawerSection = async (scope: LocationScope, user: AuthenticatedUser, canViewAllLocations: boolean) => {
  const userFilter = isAdministrator(user) || canViewAllLocations ? [] : [eq(posDrawers.userId, user.id)];
  const rows = await db.select({ id: posDrawers.id }).from(posDrawers)
    .where(and(eq(posDrawers.status, 'open'), ...locationFilters(posDrawers.locationId, scope), ...userFilter));
  return { openCount: rows.length };
};

export const getOverview = async (input: unknown, user: AuthenticatedUser) => {
  const parsed = dashboardQuerySchema.parse(input);
  const fromDate = parsed.fromDate ?? todayInColombo();
  const toDate = parsed.toDate ?? fromDate;
  const visibility = {
    allLocations: hasPermission(user, USER_PERMISSIONS.DASHBOARD_ALL_LOCATIONS_VIEW),
    forecastDetails: hasPermission(user, USER_PERMISSIONS.DASHBOARD_FORECAST_VIEW),
    inventory: hasPermission(user, USER_PERMISSIONS.DASHBOARD_INVENTORY_VIEW),
    inventoryCost: hasPermission(user, USER_PERMISSIONS.DASHBOARD_COST_VIEW),
    purchasing: hasPermission(user, USER_PERMISSIONS.DASHBOARD_PURCHASING_VIEW),
    purchasingCost: hasPermission(user, USER_PERMISSIONS.DASHBOARD_COST_VIEW),
    repairs: hasPermission(user, USER_PERMISSIONS.DASHBOARD_REPAIRS_VIEW),
    sales: hasPermission(user, USER_PERMISSIONS.DASHBOARD_SALES_VIEW),
    salesProfit: hasPermission(user, USER_PERMISSIONS.DASHBOARD_PROFIT_VIEW),
  };
  const scope = await resolveDashboardLocationScope(parsed.locationId, user, visibility.allLocations);

  const [locationRows, availableLocations, salesData, inventoryData, repairsData, purchasingData, drawerData, insights, forecast] = await Promise.all([
    scope === 'all'
      ? Promise.resolve([])
      : db.select({ id: locations.id, name: locations.name }).from(locations).where(eq(locations.id, scope)).limit(1),
    visibility.allLocations
      ? db.select({ id: locations.id, name: locations.name }).from(locations)
        .where(eq(locations.isActive, true)).orderBy(asc(locations.name))
      : Promise.resolve([]),
    visibility.sales ? salesSection(fromDate, toDate, scope, visibility.salesProfit) : Promise.resolve(null),
    visibility.inventory ? inventorySection(scope, visibility.inventoryCost) : Promise.resolve(null),
    visibility.repairs ? repairsSection(fromDate, toDate, scope) : Promise.resolve(null),
    visibility.purchasing ? purchasingSection(fromDate, toDate, scope, visibility.purchasingCost) : Promise.resolve(null),
    visibility.sales ? drawerSection(scope, user, visibility.allLocations) : Promise.resolve(null),
    getDashboardInsights(scope, visibility),
    visibility.sales ? getDashboardForecast(scope, todayInColombo(), visibility.forecastDetails) : Promise.resolve(null),
  ]);

  return {
    drawers: drawerData,
    forecast,
    insights,
    inventory: inventoryData,
    meta: {
      availableLocations,
      fromDate,
      generatedAt: Date.now(),
      location: scope === 'all' ? { id: 'all' as const, name: 'All locations' } : { id: scope, name: locationRows[0]?.name ?? 'Assigned location' },
      toDate,
    },
    purchasing: purchasingData,
    repairs: repairsData,
    sales: salesData,
    visibility,
  };
};
