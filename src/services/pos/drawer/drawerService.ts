import { and, count, eq, sql } from 'drizzle-orm';

import { db } from '../../../db';
import { auditLogs, locations, posDrawers, salePayments, sales, users } from '../../../db/schema';
import { AppError } from '../../../errors/app-error';
import type { AuthenticatedUser } from '../../auth/authService';
import { closeDrawerSchema, openDrawerSchema } from './drawerValidation';

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
  return drawer;
};

const drawerSummary = async (drawerId: number, openingCash: number, cashExpenseAmount: number) => {
  const [{ salesCount, discountAmount, totalAmount }] = await db.select({
    discountAmount: sql<string>`coalesce(sum(${sales.discountAmount}), 0)`,
    salesCount: count(sales.id),
    totalAmount: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`,
  }).from(sales).where(and(eq(sales.drawerId, drawerId), eq(sales.status, 'completed')));

  const payments = await db.select({
    amount: sql<string>`coalesce(sum(${salePayments.amount}), 0)`,
    method: salePayments.method,
  }).from(salePayments)
    .innerJoin(sales, eq(sales.id, salePayments.saleId))
    .where(and(eq(sales.drawerId, drawerId), eq(sales.status, 'completed')))
    .groupBy(salePayments.method);

  const byMethod = new Map(payments.map((payment) => [payment.method, Number(payment.amount)]));
  const cashSales = money(byMethod.get('cash') ?? 0);
  return {
    bankTransferSales: money(byMethod.get('bankTransfer') ?? 0),
    cardSales: money(byMethod.get('card') ?? 0),
    cashSales,
    discountAmount: money(Number(discountAmount)),
    expectedCash: money(openingCash + cashSales - cashExpenseAmount),
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
  return {
    drawerId: closed.id,
    difference: money(data.countedCash - summary.expectedCash),
    summary,
  };
};
