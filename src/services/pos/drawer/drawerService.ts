import { and, count, desc, eq, gte, inArray, isNotNull, lte, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';

import { db } from '../../../db';
import { auditLogs, locations, posDrawers, products, repairPayments, saleItems, saleItemStock, salePayments, sales, stock, users } from '../../../db/schema';
import { AppError } from '../../../errors/app-error';
import type { AuthenticatedUser } from '../../auth/authService';
import { safeCreateNotification } from '../../notification/notificationService';
import { closeDrawerSchema, drawerCloseHistorySchema, drawerCloseReportIdSchema, drawerLocationDaySchema, openDrawerSchema } from './drawerValidation';
import { USER_PERMISSIONS, USER_ROLES } from '../../../utils/constants';
import { resolveLocationScope, type LocationScope } from '../../shared/locationAccess';

type AuditContext = { ipAddress?: string };

const money = (value: number) => Number(value.toFixed(2));
const isAdministrator = (user: AuthenticatedUser) => user.roles.some(({ name }) => name === USER_ROLES.ADMIN);
const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const startOfColomboDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) - COLOMBO_OFFSET_MS;
};
const endOfColomboDate = (date: string) => startOfColomboDate(date) + 86_399_999;
const openedByUser = alias(users, 'drawer_opened_by');
const closedByUser = alias(users, 'drawer_closed_by');

const ensureUserLocation = (user: AuthenticatedUser) => {
  if (!user.defaultLocationId) throw new AppError('Your account does not have an assigned POS location.', 400);
  return user.defaultLocationId;
};

const drawerSelect = {
  closedAt: posDrawers.closedAt,
  closeNote: posDrawers.closeNote,
  countedBankTransferTotal: posDrawers.countedBankTransferTotal,
  countedCardTotal: posDrawers.countedCardTotal,
  countedCash: posDrawers.countedCash,
  countedMobileTotal: posDrawers.countedMobileTotal,
  cashExpenseAmount: posDrawers.cashExpenseAmount,
  id: posDrawers.id,
  locationId: posDrawers.locationId,
  locationName: locations.name,
  openedAt: posDrawers.openedAt,
  openNote: posDrawers.openNote,
  openingCash: posDrawers.openingCash,
  status: posDrawers.status,
  userId: posDrawers.userId,
  userName: users.displayName,
};

export const getCurrentDrawer = async (user: AuthenticatedUser) => {
  const locationId = ensureUserLocation(user);
  const [drawer] = await db.select(drawerSelect)
    .from(posDrawers)
    .innerJoin(locations, eq(locations.id, posDrawers.locationId))
    .innerJoin(users, eq(users.id, posDrawers.userId))
    .where(and(eq(posDrawers.locationId, locationId), eq(posDrawers.status, 'open')))
    .orderBy(desc(posDrawers.openedAt))
    .limit(1);
  return drawer ? { ...drawer, canClose: isAdministrator(user) || drawer.userId === user.id } : null;
};

export const openDrawer = async (input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const data = openDrawerSchema.parse(input);
  const locationId = ensureUserLocation(user);
  let drawerId: number;
  try {
    drawerId = await db.transaction(async (transaction) => {
      const [existing] = await transaction.select({ id: posDrawers.id }).from(posDrawers)
        .where(and(eq(posDrawers.locationId, locationId), eq(posDrawers.status, 'open')))
        .orderBy(desc(posDrawers.openedAt))
        .limit(1)
        .for('update');
      if (existing) throw new AppError('A POS drawer is already open at this location.', 409);

      const timestamp = Date.now();
      const result = await transaction.insert(posDrawers).values({
        locationId,
        openedAt: timestamp,
        openedBy: user.id,
        openingCash: String(data.openingCash),
        openNote: data.note || null,
        status: 'open',
        userId: user.id,
      });
      const id = Number(result[0].insertId);
      await transaction.insert(auditLogs).values({
        action: 'open',
        entityId: id,
        entityType: 'pos_drawer',
        ipAddress: context.ipAddress,
        module: 'pos_drawers',
        newValues: { locationId, openingCash: data.openingCash },
        timestamp,
        userId: user.id,
      });
      return id;
    });
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === 'ER_DUP_ENTRY') {
      throw new AppError('A POS drawer is already open at this location.', 409);
    }
    throw error;
  }
  const drawer = await getCurrentDrawer(user);
  if (!drawer || drawer.id !== drawerId) throw new AppError('POS drawer opened but could not be loaded.', 500);
  await safeCreateNotification({
    entityId: drawer.id,
    entityType: 'pos_drawer',
    locationId,
    message: `${drawer.userName} opened the POS drawer with LKR ${money(Number(drawer.openingCash)).toLocaleString('en-LK', { minimumFractionDigits: 2 })}.`,
    module: 'sales',
    severity: 'info',
    targetPermission: USER_PERMISSIONS.SALES_VIEW,
    title: 'POS drawer opened',
  }, user.id);
  return drawer;
};

/*
 * Every repair payment is tied to the cashier's open drawer. Keeping this
 * summary alongside sales makes the end-of-day counts reconcilable without
 * treating a repair charge as inventory revenue.
 */
type PaymentMethod = 'cash' | 'card' | 'bankTransfer' | 'mobile';
type SalePaymentMethod = PaymentMethod | 'finance';
type PaymentTotals = Record<PaymentMethod, number>;
type DrawerSummary = {
  bankTransferRepairPayments: number;
  bankTransferSales: number;
  cardRepairPayments: number;
  cardSales: number;
  cashRepairPayments: number;
  cashSales: number;
  discountAmount: number;
  expectedBankTransferTotal: number;
  expectedCardTotal: number;
  expectedCash: number;
  expectedMobileTotal: number;
  mobileRepairPayments: number;
  mobileSales: number;
  repairPaymentCount: number;
  repairPaymentTotal: number;
  salesCount: number;
  totalAmount: number;
};
type DrawerSummarySeed = { cashExpenseAmount: number; id: number; openingCash: number };
type PaymentAggregate = { amount: string; drawerId: number | null; method: SalePaymentMethod; paymentCount?: number };

const emptyPaymentTotals = (): PaymentTotals => ({ bankTransfer: 0, card: 0, cash: 0, mobile: 0 });
const paymentTotals = (rows: PaymentAggregate[]): PaymentTotals => rows.reduce((totals, row) => {
  // Finance is part of sale revenue, but it is not cash/card/bank/mobile money
  // physically reconciled in the drawer.
  if (row.method !== 'finance') totals[row.method] = money(totals[row.method] + Number(row.amount));
  return totals;
}, emptyPaymentTotals());

const buildDrawerSummary = (
  drawer: DrawerSummarySeed,
  salesTotals: { discountAmount: string; salesCount: number; totalAmount: string } | undefined,
  salePayments: PaymentAggregate[],
  repairPaymentsByMethod: PaymentAggregate[],
): DrawerSummary => {
  const salesByMethod = paymentTotals(salePayments);
  const repairsByMethod = paymentTotals(repairPaymentsByMethod);
  const repairPaymentCount = repairPaymentsByMethod.reduce((total, payment) => total + Number(payment.paymentCount ?? 0), 0);
  const repairPaymentTotal = money(Object.values(repairsByMethod).reduce((total, value) => total + value, 0));
  return {
    bankTransferRepairPayments: repairsByMethod.bankTransfer,
    bankTransferSales: salesByMethod.bankTransfer,
    cardRepairPayments: repairsByMethod.card,
    cardSales: salesByMethod.card,
    cashRepairPayments: repairsByMethod.cash,
    cashSales: salesByMethod.cash,
    discountAmount: money(Number(salesTotals?.discountAmount ?? 0)),
    expectedBankTransferTotal: money(salesByMethod.bankTransfer + repairsByMethod.bankTransfer),
    expectedCardTotal: money(salesByMethod.card + repairsByMethod.card),
    expectedCash: money(drawer.openingCash + salesByMethod.cash + repairsByMethod.cash - drawer.cashExpenseAmount),
    expectedMobileTotal: money(salesByMethod.mobile + repairsByMethod.mobile),
    mobileRepairPayments: repairsByMethod.mobile,
    mobileSales: salesByMethod.mobile,
    repairPaymentCount,
    repairPaymentTotal,
    salesCount: Number(salesTotals?.salesCount ?? 0),
    totalAmount: money(Number(salesTotals?.totalAmount ?? 0)),
  };
};

/** Loads all payment evidence in three grouped queries, even for a full report page. */
const drawerSummaries = async (drawers: DrawerSummarySeed[]) => {
  const drawerIds = drawers.map(({ id }) => id);
  if (!drawerIds.length) return new Map<number, DrawerSummary>();
  const [salesTotals, salePaymentRows, repairPaymentRows] = await Promise.all([
    db.select({
      discountAmount: sql<string>`coalesce(sum(${sales.discountAmount}), 0)`,
      drawerId: sales.drawerId,
      salesCount: count(sales.id),
      totalAmount: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`,
    }).from(sales)
      .where(and(inArray(sales.drawerId, drawerIds), eq(sales.status, 'completed')))
      .groupBy(sales.drawerId),
    db.select({
      amount: sql<string>`coalesce(sum(${salePayments.amount}), 0)`,
      drawerId: sales.drawerId,
      method: salePayments.method,
    }).from(salePayments)
      .innerJoin(sales, eq(sales.id, salePayments.saleId))
      .where(and(inArray(sales.drawerId, drawerIds), eq(sales.status, 'completed')))
      .groupBy(sales.drawerId, salePayments.method),
    db.select({
      amount: sql<string>`coalesce(sum(${repairPayments.amount}), 0)`,
      drawerId: repairPayments.drawerId,
      method: repairPayments.method,
      paymentCount: count(repairPayments.id),
    }).from(repairPayments)
      .where(inArray(repairPayments.drawerId, drawerIds))
      .groupBy(repairPayments.drawerId, repairPayments.method),
  ]);

  const totalsByDrawer = new Map<number, { discountAmount: string; salesCount: number; totalAmount: string }>();
  const salesPaymentsByDrawer = new Map<number, PaymentAggregate[]>();
  const repairPaymentsByDrawer = new Map<number, PaymentAggregate[]>();
  for (const row of salesTotals) if (row.drawerId !== null) {
    totalsByDrawer.set(row.drawerId, { discountAmount: row.discountAmount, salesCount: Number(row.salesCount), totalAmount: row.totalAmount });
  }
  for (const row of salePaymentRows) if (row.drawerId !== null) {
    const values = salesPaymentsByDrawer.get(row.drawerId) ?? [];
    values.push({ amount: row.amount, drawerId: row.drawerId, method: row.method });
    salesPaymentsByDrawer.set(row.drawerId, values);
  }
  for (const row of repairPaymentRows) if (row.drawerId !== null) {
    const values = repairPaymentsByDrawer.get(row.drawerId) ?? [];
    values.push({ amount: row.amount, drawerId: row.drawerId, method: row.method, paymentCount: Number(row.paymentCount) });
    repairPaymentsByDrawer.set(row.drawerId, values);
  }
  return new Map(drawers.map((drawer) => [
    drawer.id,
    buildDrawerSummary(drawer, totalsByDrawer.get(drawer.id), salesPaymentsByDrawer.get(drawer.id) ?? [], repairPaymentsByDrawer.get(drawer.id) ?? []),
  ]));
};

const drawerSummary = async (drawerId: number, openingCash: number, cashExpenseAmount: number) =>
  (await drawerSummaries([{ cashExpenseAmount, id: drawerId, openingCash }])).get(drawerId)
  ?? buildDrawerSummary({ cashExpenseAmount, id: drawerId, openingCash }, undefined, [], []);

export const closeDrawer = async (input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const data = closeDrawerSchema.parse(input);
  const locationId = ensureUserLocation(user);
  const closed = await db.transaction(async (transaction) => {
    // Select only the fields required for closing. This keeps the controlled
    // reconciliation path usable while an existing installation is being
    // migrated to the generated `open_location_id` column.
    const [drawer] = await transaction.select({
      id: posDrawers.id,
      openingCash: posDrawers.openingCash,
      userId: posDrawers.userId,
    }).from(posDrawers)
      .where(and(eq(posDrawers.locationId, locationId), eq(posDrawers.status, 'open')))
      .orderBy(desc(posDrawers.openedAt))
      .limit(1)
      .for('update');
    if (!drawer) throw new AppError('Open a POS drawer before closing.', 409);
    if (!isAdministrator(user) && drawer.userId !== user.id) {
      throw new AppError('Only the drawer opener or an administrator can close this location drawer.', 403);
    }

    const timestamp = Date.now();
    await transaction.update(posDrawers).set({
      cashExpenseAmount: String(data.cashExpenseAmount),
      closedAt: timestamp,
      closedBy: user.id,
      closeNote: data.note || null,
      countedBankTransferTotal: String(data.countedBankTransferTotal),
      countedCardTotal: String(data.countedCardTotal),
      countedCash: String(data.countedCash),
      countedMobileTotal: String(data.countedMobileTotal),
      status: 'closed',
    }).where(eq(posDrawers.id, drawer.id));
    await transaction.insert(auditLogs).values({
      action: 'close',
      entityId: drawer.id,
      entityType: 'pos_drawer',
      ipAddress: context.ipAddress,
      module: 'pos_drawers',
      newValues: data,
      timestamp,
      userId: user.id,
    });
    return { id: drawer.id, openingCash: Number(drawer.openingCash) };
  });
  const summary = await drawerSummary(closed.id, closed.openingCash, data.cashExpenseAmount);
  const difference = money(data.countedCash - summary.expectedCash);
  await safeCreateNotification({
    entityId: closed.id,
    entityType: 'pos_drawer',
    locationId,
    message: difference === 0
      ? `Drawer closed with no cash difference. Sales total LKR ${summary.totalAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}; repair payments LKR ${summary.repairPaymentTotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}.`
      : `Drawer closed with ${difference > 0 ? 'over' : 'short'} difference of LKR ${Math.abs(difference).toLocaleString('en-LK', { minimumFractionDigits: 2 })}. Expected cash LKR ${summary.expectedCash.toLocaleString('en-LK', { minimumFractionDigits: 2 })}, counted LKR ${money(data.countedCash).toLocaleString('en-LK', { minimumFractionDigits: 2 })}.`,
    module: 'sales',
    severity: difference === 0 ? 'success' : 'critical',
    targetPermission: USER_PERMISSIONS.SALES_VIEW,
    title: difference === 0 ? 'POS drawer closed' : 'Drawer cash mismatch',
  }, user.id);
  return {
    drawerId: closed.id,
    difference,
    summary,
  };
};

const closedDrawerSelect = {
  cashExpenseAmount: posDrawers.cashExpenseAmount,
  closedAt: posDrawers.closedAt,
  closedById: posDrawers.closedBy,
  closedByName: closedByUser.displayName,
  closeNote: posDrawers.closeNote,
  countedBankTransferTotal: posDrawers.countedBankTransferTotal,
  countedCardTotal: posDrawers.countedCardTotal,
  countedCash: posDrawers.countedCash,
  countedMobileTotal: posDrawers.countedMobileTotal,
  id: posDrawers.id,
  locationId: posDrawers.locationId,
  locationName: locations.name,
  openedAt: posDrawers.openedAt,
  openedById: posDrawers.openedBy,
  openedByName: openedByUser.displayName,
  openNote: posDrawers.openNote,
  openingCash: posDrawers.openingCash,
};

const toNullableMoney = (value: string | null) => value === null ? null : money(Number(value));
const difference = (counted: number | null, expected: number) => counted === null ? null : money(counted - expected);

/**
 * Retain an explicit distinction between the expected system total and the
 * physical amount counted at close.  A missing legacy count is never shown as
 * a misleading zero-value reconciliation.
 */
const closeReport = <T extends {
  cashExpenseAmount: string | null;
  closedAt: number | null;
  countedBankTransferTotal: string | null;
  countedCardTotal: string | null;
  countedCash: string | null;
  countedMobileTotal: string | null;
  openingCash: string;
}>(drawer: T, summary: DrawerSummary) => {
  const counted = {
    bankTransfer: toNullableMoney(drawer.countedBankTransferTotal),
    card: toNullableMoney(drawer.countedCardTotal),
    cash: toNullableMoney(drawer.countedCash),
    mobile: toNullableMoney(drawer.countedMobileTotal),
  };
  const expected = {
    bankTransfer: summary.expectedBankTransferTotal,
    card: summary.expectedCardTotal,
    cash: summary.expectedCash,
    mobile: summary.expectedMobileTotal,
  };
  const differences = {
    bankTransfer: difference(counted.bankTransfer, expected.bankTransfer),
    card: difference(counted.card, expected.card),
    cash: difference(counted.cash, expected.cash),
    mobile: difference(counted.mobile, expected.mobile),
  };
  const hasEveryCount = Object.values(counted).every((value) => value !== null);
  const countedValues = Object.values(counted).filter((value): value is number => value !== null);
  const differenceValues = Object.values(differences).filter((value): value is number => value !== null);
  return {
    drawer: {
      ...drawer,
      cashExpenseAmount: toNullableMoney(drawer.cashExpenseAmount),
      openingCash: money(Number(drawer.openingCash)),
    },
    reconciliation: {
      counted,
      difference: hasEveryCount ? money(differenceValues.reduce((total, value) => total + value, 0)) : null,
      differences,
      expected,
      expectedTotal: money(Object.values(expected).reduce((total, value) => total + value, 0)),
      isComplete: hasEveryCount,
      settlement: !hasEveryCount ? 'incomplete' : differences.cash === 0 && differences.card === 0 && differences.bankTransfer === 0 && differences.mobile === 0 ? 'balanced' : 'variance',
      totalCounted: hasEveryCount ? money(countedValues.reduce((total, value) => total + value, 0)) : null,
    },
    summary,
  };
};

const closedDrawerQuery = () => db.select(closedDrawerSelect)
  .from(posDrawers)
  .innerJoin(locations, eq(locations.id, posDrawers.locationId))
  .innerJoin(openedByUser, eq(openedByUser.id, posDrawers.openedBy))
  .leftJoin(closedByUser, eq(closedByUser.id, posDrawers.closedBy));

/**
 * Staff only ever receive reports for their assigned location.  Administrators
 * may choose a location or use an all-location history, matching the existing
 * dashboard location-access model.
 */
export const listClosedDrawerReports = async (input: unknown, user: AuthenticatedUser) => {
  const query = drawerCloseHistorySchema.parse(input);
  if (query.fromDate && query.toDate && startOfColomboDate(query.fromDate) > startOfColomboDate(query.toDate)) {
    throw new AppError('From date cannot be after to date.', 400);
  }
  if (query.fromDate && query.toDate && endOfColomboDate(query.toDate) - startOfColomboDate(query.fromDate) > 370 * 86_400_000) {
    throw new AppError('Date range cannot be longer than 370 days.', 400);
  }

  const scope: LocationScope = await resolveLocationScope(query.locationId, user);
  const filters: SQL[] = [eq(posDrawers.status, 'closed'), isNotNull(posDrawers.closedAt)];
  if (scope !== 'all') filters.push(eq(posDrawers.locationId, scope));
  if (query.fromDate) filters.push(gte(posDrawers.closedAt, startOfColomboDate(query.fromDate)));
  if (query.toDate) filters.push(lte(posDrawers.closedAt, endOfColomboDate(query.toDate)));
  const where = and(...filters);
  const offset = (query.page - 1) * query.pageSize;
  const [drawers, [{ total }]] = await Promise.all([
    closedDrawerQuery().where(where).orderBy(desc(posDrawers.closedAt), desc(posDrawers.id)).limit(query.pageSize).offset(offset),
    db.select({ total: count() }).from(posDrawers).where(where),
  ]);
  const summaries = await drawerSummaries(drawers.map((drawer) => ({
    cashExpenseAmount: Number(drawer.cashExpenseAmount ?? 0),
    id: drawer.id,
    openingCash: Number(drawer.openingCash),
  })));
  return {
    items: drawers.map((drawer) => {
      const summary = summaries.get(drawer.id) ?? buildDrawerSummary({
        cashExpenseAmount: Number(drawer.cashExpenseAmount ?? 0), id: drawer.id, openingCash: Number(drawer.openingCash),
      }, undefined, [], []);
      return closeReport(drawer, summary);
    }),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / query.pageSize),
    },
  };
};

type SoldUnit = {
  barcode: string | null;
  invoiceNo: string;
  soldAt: number;
  stockId: number | null;
};

type ProductSalesLine = {
  discountAmount: number;
  grossAmount: number;
  id: number;
  name: string;
  netAmount: number;
  quantity: number;
  salesCount: number;
  sku: string | null;
  units: SoldUnit[];
};

type SalesActivity = {
  products: ProductSalesLine[];
  sales: {
    averageSaleValue: number;
    discountAmount: number;
    grossAmount: number;
    netAmount: number;
    paidAmount: number;
    salesCount: number;
  };
  financials?: {
    costCoverage: { complete: boolean; totalUnits: number; trackedUnits: number };
    costOfGoods: number;
    grossProfit: number;
    marginPercent: number | null;
  };
};

const canViewProfit = (user: AuthenticatedUser) =>
  isAdministrator(user) || user.permissions.includes(USER_PERMISSIONS.DASHBOARD_PROFIT_VIEW);

/**
 * Builds an audit-friendly sales activity report from immutable sale items and
 * the sold stock-unit links. Barcodes are nested under their product so the
 * main report remains readable even for high-volume days.
 */
const salesActivity = async (where: SQL | undefined, includeProfit: boolean): Promise<SalesActivity> => {
  const rows = await db.select({
    barcode: stock.barcode,
    costPrice: stock.costPrice,
    invoiceNo: sales.invoiceNo,
    lineDiscountAmount: saleItems.discountAmount,
    lineTotalAmount: saleItems.totalAmount,
    productId: products.id,
    productName: products.name,
    productSku: products.sku,
    quantity: saleItems.quantity,
    saleDiscountAmount: sales.discountAmount,
    saleId: sales.id,
    saleItemId: saleItems.id,
    salePaidAmount: sales.paidAmount,
    saleSubTotal: sales.subTotal,
    saleTimestamp: sales.timestamp,
    saleTotalAmount: sales.totalAmount,
    stockId: stock.id,
    unitPrice: saleItems.unitPrice,
  }).from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .innerJoin(products, eq(products.id, saleItems.productId))
    .leftJoin(saleItemStock, eq(saleItemStock.saleItemId, saleItems.id))
    .leftJoin(stock, eq(stock.id, saleItemStock.stockId))
    .where(and(eq(sales.status, 'completed'), where))
    .orderBy(desc(sales.timestamp), saleItems.id, stock.id);

  type SaleItemSnapshot = {
    discountAmount: number;
    id: number;
    netAmount: number;
    productId: number;
    productName: string;
    productSku: string | null;
    quantity: number;
    saleId: number;
    units: Array<SoldUnit & { costPrice: number | null }>;
    unitPrice: number;
  };
  const itemsById = new Map<number, SaleItemSnapshot>();
  const salesById = new Map<number, { discountAmount: number; grossAmount: number; netAmount: number; paidAmount: number }>();
  for (const row of rows) {
    if (!salesById.has(row.saleId)) {
      salesById.set(row.saleId, {
        discountAmount: money(Number(row.saleDiscountAmount)),
        grossAmount: money(Number(row.saleSubTotal)),
        netAmount: money(Number(row.saleTotalAmount)),
        paidAmount: money(Number(row.salePaidAmount)),
      });
    }
    let item = itemsById.get(row.saleItemId);
    if (!item) {
      item = {
        discountAmount: money(Number(row.lineDiscountAmount)),
        id: row.saleItemId,
        netAmount: money(Number(row.lineTotalAmount)),
        productId: row.productId,
        productName: row.productName,
        productSku: row.productSku,
        quantity: row.quantity,
        saleId: row.saleId,
        units: [],
        unitPrice: money(Number(row.unitPrice)),
      };
      itemsById.set(row.saleItemId, item);
    }
    if (row.stockId !== null) {
      item.units.push({
        barcode: row.barcode,
        costPrice: row.costPrice === null ? null : money(Number(row.costPrice)),
        invoiceNo: row.invoiceNo,
        soldAt: row.saleTimestamp,
        stockId: row.stockId,
      });
    }
  }

  const productLines = new Map<number, ProductSalesLine & { costs: number; trackedUnits: number; saleIds: Set<number> }>();
  for (const item of itemsById.values()) {
    let product = productLines.get(item.productId);
    if (!product) {
      product = {
        costs: 0,
        discountAmount: 0,
        grossAmount: 0,
        id: item.productId,
        name: item.productName,
        netAmount: 0,
        quantity: 0,
        saleIds: new Set<number>(),
        salesCount: 0,
        sku: item.productSku,
        trackedUnits: 0,
        units: [],
      };
      productLines.set(item.productId, product);
    }
    product.discountAmount = money(product.discountAmount + item.discountAmount);
    product.grossAmount = money(product.grossAmount + item.unitPrice * item.quantity);
    product.netAmount = money(product.netAmount + item.netAmount);
    product.quantity += item.quantity;
    product.saleIds.add(item.saleId);
    for (const unit of item.units) {
      product.units.push({ barcode: unit.barcode, invoiceNo: unit.invoiceNo, soldAt: unit.soldAt, stockId: unit.stockId });
      if (unit.costPrice !== null) {
        product.costs = money(product.costs + unit.costPrice);
        product.trackedUnits += 1;
      }
    }
  }

  const productsOutput = [...productLines.values()].map(({ costs: _costs, saleIds, trackedUnits: _trackedUnits, ...product }) => ({
    ...product,
    salesCount: saleIds.size,
    units: product.units.sort((a, b) => b.soldAt - a.soldAt || (a.stockId ?? 0) - (b.stockId ?? 0)),
  })).sort((a, b) => b.netAmount - a.netAmount || a.name.localeCompare(b.name));
  const saleRows = [...salesById.values()];
  const salesSummary = {
    averageSaleValue: saleRows.length ? money(saleRows.reduce((total, sale) => total + sale.netAmount, 0) / saleRows.length) : 0,
    discountAmount: money(saleRows.reduce((total, sale) => total + sale.discountAmount, 0)),
    grossAmount: money(saleRows.reduce((total, sale) => total + sale.grossAmount, 0)),
    netAmount: money(saleRows.reduce((total, sale) => total + sale.netAmount, 0)),
    paidAmount: money(saleRows.reduce((total, sale) => total + sale.paidAmount, 0)),
    salesCount: saleRows.length,
  };
  if (!includeProfit) return { products: productsOutput, sales: salesSummary };

  const rawProducts = [...productLines.values()];
  const totalUnits = rawProducts.reduce((total, product) => total + product.quantity, 0);
  const trackedUnits = rawProducts.reduce((total, product) => total + product.trackedUnits, 0);
  const costOfGoods = money(rawProducts.reduce((total, product) => total + product.costs, 0));
  const grossProfit = money(salesSummary.netAmount - costOfGoods);
  return {
    financials: {
      costCoverage: { complete: totalUnits === trackedUnits, totalUnits, trackedUnits },
      costOfGoods,
      grossProfit,
      marginPercent: salesSummary.netAmount ? money((grossProfit / salesSummary.netAmount) * 100) : null,
    },
    products: productsOutput,
    sales: salesSummary,
  };
};

const drawerPerformanceUser = alias(users, 'day_drawer_opened_by');

const locationDayDrawerPerformance = async (locationId: number, date: string) => {
  const rows = await db.select({
    drawerId: sales.drawerId,
    drawerStatus: posDrawers.status,
    openedByName: drawerPerformanceUser.displayName,
    salesCount: count(sales.id),
    totalAmount: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`,
  }).from(sales)
    .leftJoin(posDrawers, eq(posDrawers.id, sales.drawerId))
    .leftJoin(drawerPerformanceUser, eq(drawerPerformanceUser.id, posDrawers.openedBy))
    .where(and(
      eq(sales.status, 'completed'),
      eq(sales.locationId, locationId),
      gte(sales.timestamp, startOfColomboDate(date)),
      lte(sales.timestamp, endOfColomboDate(date)),
    ))
    .groupBy(sales.drawerId, posDrawers.status, drawerPerformanceUser.displayName)
    .orderBy(desc(sql`coalesce(sum(${sales.totalAmount}), 0)`));
  return rows.map((row) => ({
    drawerId: row.drawerId,
    label: row.drawerId === null ? 'Unassigned legacy sales' : `Drawer #${row.drawerId}`,
    openedByName: row.openedByName,
    salesCount: Number(row.salesCount),
    status: row.drawerStatus ?? 'legacy',
    totalAmount: money(Number(row.totalAmount)),
  }));
};

export const getClosedDrawerReport = async (input: unknown, user: AuthenticatedUser) => {
  const id = drawerCloseReportIdSchema.parse(input);
  const [drawer] = await closedDrawerQuery()
    .where(and(eq(posDrawers.id, id), eq(posDrawers.status, 'closed'), isNotNull(posDrawers.closedAt)))
    .limit(1);
  if (!drawer) throw new AppError('Closed drawer report not found.', 404);

  // Resolve against the concrete record to prevent an ID from exposing another
  // branch's closing figures, even when an employee guesses a drawer ID.
  await resolveLocationScope(drawer.locationId, user);
  const [summary, shift] = await Promise.all([
    drawerSummary(drawer.id, Number(drawer.openingCash), Number(drawer.cashExpenseAmount ?? 0)),
    salesActivity(eq(sales.drawerId, drawer.id), canViewProfit(user)),
  ]);
  return { ...closeReport(drawer, summary), shift };
};

/**
 * A business-day view intentionally uses the selected drawer only to establish
 * the authorised location. It includes every completed sale at that location,
 * including sales made while another drawer is still open.
 */
export const getDrawerLocationDayReport = async (input: unknown, queryInput: unknown, user: AuthenticatedUser) => {
  const id = drawerCloseReportIdSchema.parse(input);
  const { date } = drawerLocationDaySchema.parse(queryInput);
  const [drawer] = await closedDrawerQuery()
    .where(and(eq(posDrawers.id, id), eq(posDrawers.status, 'closed'), isNotNull(posDrawers.closedAt)))
    .limit(1);
  if (!drawer) throw new AppError('Closed drawer report not found.', 404);
  await resolveLocationScope(drawer.locationId, user);

  const dateFilter = and(
    eq(sales.locationId, drawer.locationId),
    gte(sales.timestamp, startOfColomboDate(date)),
    lte(sales.timestamp, endOfColomboDate(date)),
  );
  const [activity, drawerPerformance] = await Promise.all([
    salesActivity(dateFilter, canViewProfit(user)),
    locationDayDrawerPerformance(drawer.locationId, date),
  ]);
  return {
    ...activity,
    date,
    drawerPerformance,
    location: { id: drawer.locationId, name: drawer.locationName },
  };
};
