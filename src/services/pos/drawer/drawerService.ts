import { and, count, eq, sql } from 'drizzle-orm';

import { db } from '../../../db';
import { auditLogs, locations, posDrawers, repairPayments, salePayments, sales, users } from '../../../db/schema';
import { AppError } from '../../../errors/app-error';
import type { AuthenticatedUser } from '../../auth/authService';
import { safeCreateNotification } from '../../notification/notificationService';
import { closeDrawerSchema, openDrawerSchema } from './drawerValidation';
import { USER_PERMISSIONS } from '../../../utils/constants';

type AuditContext = { ipAddress?: string };

const money = (value: number) => Number(value.toFixed(2));

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
    .where(and(eq(posDrawers.userId, user.id), eq(posDrawers.locationId, locationId), eq(posDrawers.status, 'open')))
    .limit(1);
  return drawer ?? null;
};

export const openDrawer = async (input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const data = openDrawerSchema.parse(input);
  const locationId = ensureUserLocation(user);
  const drawerId = await db.transaction(async (transaction) => {
    const [existing] = await transaction.select({ id: posDrawers.id }).from(posDrawers)
      .where(and(eq(posDrawers.userId, user.id), eq(posDrawers.locationId, locationId), eq(posDrawers.status, 'open')))
      .limit(1)
      .for('update');
    if (existing) throw new AppError('A POS drawer is already open for your account at this location.', 409);

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
const drawerSummary = async (drawerId: number, openingCash: number, cashExpenseAmount: number) => {
  const [[{ salesCount, discountAmount, totalAmount }], salePaymentRows, repairPaymentRows] = await Promise.all([
    db.select({
      discountAmount: sql<string>`coalesce(sum(${sales.discountAmount}), 0)`,
      salesCount: count(sales.id),
      totalAmount: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`,
    }).from(sales).where(and(eq(sales.drawerId, drawerId), eq(sales.status, 'completed'))),
    db.select({
      amount: sql<string>`coalesce(sum(${salePayments.amount}), 0)`,
      method: salePayments.method,
    }).from(salePayments)
      .innerJoin(sales, eq(sales.id, salePayments.saleId))
      .where(and(eq(sales.drawerId, drawerId), eq(sales.status, 'completed')))
      .groupBy(salePayments.method),
    db.select({
      amount: sql<string>`coalesce(sum(${repairPayments.amount}), 0)`,
      method: repairPayments.method,
      paymentCount: count(repairPayments.id),
    }).from(repairPayments)
      .where(eq(repairPayments.drawerId, drawerId))
      .groupBy(repairPayments.method),
  ]);

  const salesByMethod = new Map(salePaymentRows.map((payment) => [payment.method, Number(payment.amount)]));
  const repairsByMethod = new Map(repairPaymentRows.map((payment) => [payment.method, Number(payment.amount)]));
  const repairPaymentCount = repairPaymentRows.reduce((total, payment) => total + Number(payment.paymentCount), 0);
  const cashSales = money(salesByMethod.get('cash') ?? 0);
  const cardSales = money(salesByMethod.get('card') ?? 0);
  const bankTransferSales = money(salesByMethod.get('bankTransfer') ?? 0);
  const mobileSales = money(salesByMethod.get('mobile') ?? 0);
  const cashRepairPayments = money(repairsByMethod.get('cash') ?? 0);
  const cardRepairPayments = money(repairsByMethod.get('card') ?? 0);
  const bankTransferRepairPayments = money(repairsByMethod.get('bankTransfer') ?? 0);
  const mobileRepairPayments = money(repairsByMethod.get('mobile') ?? 0);
  const repairPaymentTotal = money(cashRepairPayments + cardRepairPayments + bankTransferRepairPayments + mobileRepairPayments);
  return {
    bankTransferRepairPayments,
    bankTransferSales,
    cardRepairPayments,
    cardSales,
    cashRepairPayments,
    cashSales,
    discountAmount: money(Number(discountAmount)),
    expectedBankTransferTotal: money(bankTransferSales + bankTransferRepairPayments),
    expectedCardTotal: money(cardSales + cardRepairPayments),
    expectedCash: money(openingCash + cashSales + cashRepairPayments - cashExpenseAmount),
    expectedMobileTotal: money(mobileSales + mobileRepairPayments),
    mobileRepairPayments,
    mobileSales,
    repairPaymentCount,
    repairPaymentTotal,
    salesCount: Number(salesCount),
    totalAmount: money(Number(totalAmount)),
  };
};

export const closeDrawer = async (input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const data = closeDrawerSchema.parse(input);
  const locationId = ensureUserLocation(user);
  const closed = await db.transaction(async (transaction) => {
    const [drawer] = await transaction.select().from(posDrawers)
      .where(and(eq(posDrawers.userId, user.id), eq(posDrawers.locationId, locationId), eq(posDrawers.status, 'open')))
      .limit(1)
      .for('update');
    if (!drawer) throw new AppError('Open a POS drawer before closing.', 409);

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
