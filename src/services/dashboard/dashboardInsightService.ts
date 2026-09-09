import { and, asc, count, desc, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';

import { db } from '../../db';
import {
  grns,
  dashboardInsightActions,
  products,
  repairHistory,
  repairJobs,
  saleItems,
  sales,
  stock,
  stockStatuses,
  supplierInvoices,
  suppliers,
} from '../../db/schema';
import { logger } from '../../logger/logger';
import { STOCK_STATUS } from '../../utils/constants';
import type { LocationScope } from '../shared/locationAccess';
import { getActiveDashboardTarget, getDashboardInsightSettings, type DashboardInsightSettings } from './dashboardConfigService';

const DAY_MS = 86_400_000;
const COLOMBO_OFFSET_MS = 19_800_000;
const INSIGHT_CACHE_TTL_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 100;

export type DashboardInsight = {
  action: string;
  confidence: 'low' | 'medium' | 'high' | 'rule';
  domain: 'sales' | 'inventory' | 'purchasing' | 'repairs';
  id: string;
  message: string;
  metric: {
    format: 'currency' | 'number' | 'percent';
    label: string;
    value: number;
  };
  period: string;
  severity: 'critical' | 'warning' | 'opportunity' | 'positive';
  title: string;
  actionState?: 'resolved' | 'dismissed';
  actionNote?: string | null;
  actionedAt?: number;
};

type InsightVisibility = {
  inventory: boolean;
  purchasing: boolean;
  purchasingCost: boolean;
  repairs: boolean;
  sales: boolean;
};

const insightCache = new Map<string, { expiresAt: number; value: DashboardInsight[] }>();
export const clearDashboardInsightCache = () => insightCache.clear();

const money = (value: unknown) => Number(Number(value ?? 0).toFixed(2));
const dateAtUtc = (value: string) => Date.parse(`${value}T00:00:00.000Z`);
const addDays = (value: string, days: number) => new Date(dateAtUtc(value) + days * DAY_MS).toISOString().slice(0, 10);
const dayStart = (date: string) => new Date(`${date}T00:00:00.000+05:30`).getTime();
const todayInColombo = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: '2-digit', timeZone: 'Asia/Colombo', year: 'numeric',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${value.year}-${value.month}-${value.day}`;
};
const locationFilters = (column: Parameters<typeof eq>[0], scope: LocationScope) => (
  scope === 'all' ? [] : [eq(column, scope)]
);
const sumDateRange = (daily: Map<number, { saleCount: number; totalAmount: number }>, fromDate: string, toDate: string) => {
  const days = Math.floor((dateAtUtc(toDate) - dateAtUtc(fromDate)) / DAY_MS) + 1;
  const summary = { saleCount: 0, totalAmount: 0 };
  Array.from({ length: Math.max(days, 0) }, (_, index) => {
    const date = addDays(fromDate, index);
    return daily.get(Math.floor((dateAtUtc(date) + COLOMBO_OFFSET_MS) / DAY_MS));
  }).forEach((row) => {
    summary.saleCount += row?.saleCount ?? 0;
    summary.totalAmount += row?.totalAmount ?? 0;
  });
  return summary;
};
const confidenceFromSamples = (samples: number): DashboardInsight['confidence'] => (
  samples >= 40 ? 'high' : samples >= 15 ? 'medium' : 'low'
);
const listNames = (names: string[]) => names.slice(0, 3).join(', ');

const salesInsights = async (scope: LocationScope, today: string, settings: DashboardInsightSettings): Promise<DashboardInsight[]> => {
  const oldestDate = addDays(today, -40);
  const dayBucket = sql<number>`floor((${sales.timestamp} + ${COLOMBO_OFFSET_MS}) / ${DAY_MS})`;
  const rows = await db.select({
    bucket: dayBucket,
    saleCount: count(),
    totalAmount: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`,
  }).from(sales).where(and(
    eq(sales.status, 'completed'),
    sql`${sales.timestamp} >= ${dayStart(oldestDate)}`,
    ...locationFilters(sales.locationId, scope),
  )).groupBy(dayBucket).orderBy(asc(dayBucket));

  const daily = new Map(rows.map((row) => [Number(row.bucket), {
    saleCount: Number(row.saleCount), totalAmount: money(row.totalAmount),
  }]));
  const lastSeven = sumDateRange(daily, addDays(today, -6), today);
  const previousSeven = sumDateRange(daily, addDays(today, -13), addDays(today, -7));
  const insights: DashboardInsight[] = [];

  if (previousSeven.totalAmount > 0) {
    const change = Number((((lastSeven.totalAmount - previousSeven.totalAmount) / previousSeven.totalAmount) * 100).toFixed(1));
    if (change <= -settings.salesDeclinePercent) {
      insights.push({
        action: 'Review the daily sales trend and focus the team on the strongest converting products.',
        confidence: confidenceFromSamples(lastSeven.saleCount + previousSeven.saleCount),
        domain: 'sales',
        id: 'sales-seven-day-decline',
        message: `Completed sales are ${Math.abs(change).toFixed(1)}% below the previous seven days.`,
        metric: { format: 'percent', label: '7-day change', value: change },
        period: 'Last 7 days vs previous 7 days',
        severity: change <= -25 ? 'critical' : 'warning',
        title: 'Sales momentum has slowed',
      });
    }
  }

  const utcWeekday = new Date(`${today}T00:00:00.000Z`).getUTCDay();
  const elapsedWeekDays = ((utcWeekday + 6) % 7) + 1;
  const weekStart = addDays(today, -(elapsedWeekDays - 1));
  const historical = sumDateRange(daily, addDays(weekStart, -28), addDays(weekStart, -1));
  const currentWeek = sumDateRange(daily, weekStart, today);
  const weeklyBaseline = historical.totalAmount / 4;
  const officialTarget = await getActiveDashboardTarget(scope, 'weekly', today);

  if (officialTarget || weeklyBaseline > 0) {
    const targetAmount = officialTarget?.targetAmount ?? money(weeklyBaseline * (1 + settings.suggestedTargetGrowthPercent / 100));
    const progress = Number(((currentWeek.totalAmount / targetAmount) * 100).toFixed(1));
    const expectedProgress = (elapsedWeekDays / 7) * 100;
    const onTrack = progress >= expectedProgress * 0.85;
    const remaining = Math.max(money(targetAmount - currentWeek.totalAmount), 0);
    insights.push({
      action: onTrack
        ? 'Maintain the current pace and monitor progress each day.'
        : 'Prioritize active leads and fast-selling products to recover the weekly pace.',
      confidence: officialTarget ? 'rule' : confidenceFromSamples(historical.saleCount),
      domain: 'sales',
      id: 'sales-suggested-weekly-target',
      message: remaining === 0
        ? `This week is already above the ${officialTarget ? 'official' : 'suggested'} target of LKR ${targetAmount.toLocaleString('en-LK')}.`
        : `LKR ${remaining.toLocaleString('en-LK')} remains to reach the ${officialTarget ? 'official' : 'suggested'} target of LKR ${targetAmount.toLocaleString('en-LK')}.`,
      metric: { format: 'percent', label: 'Target progress', value: progress },
      period: officialTarget ? 'Current week • official location target' : `Current week • suggested from prior 4-week average + ${settings.suggestedTargetGrowthPercent}%`,
      severity: remaining === 0 ? 'positive' : onTrack ? 'opportunity' : 'warning',
      title: remaining === 0 ? `${officialTarget ? 'Official' : 'Suggested'} weekly target achieved` : 'Weekly target progress',
    });
  }

  const monthStart = `${today.slice(0, 7)}-01`;
  const monthlyTarget = await getActiveDashboardTarget(scope, 'monthly', today);
  if (monthlyTarget) {
    const currentMonth = sumDateRange(daily, monthStart, today);
    const progress = Number(((currentMonth.totalAmount / monthlyTarget.targetAmount) * 100).toFixed(1));
    const remaining = Math.max(money(monthlyTarget.targetAmount - currentMonth.totalAmount), 0);
    insights.push({
      action: remaining === 0 ? 'Maintain the current pace and review the next month’s target with management.' : 'Use daily sales reviews to keep the location on pace for its official monthly target.',
      confidence: 'rule',
      domain: 'sales',
      id: 'sales-official-monthly-target',
      message: remaining === 0
        ? `This month is above the official target of LKR ${monthlyTarget.targetAmount.toLocaleString('en-LK')}.`
        : `LKR ${remaining.toLocaleString('en-LK')} remains to reach this month’s official target of LKR ${monthlyTarget.targetAmount.toLocaleString('en-LK')}.`,
      metric: { format: 'percent', label: 'Monthly progress', value: progress },
      period: 'Current month • official location target',
      severity: remaining === 0 ? 'positive' : 'opportunity',
      title: remaining === 0 ? 'Official monthly target achieved' : 'Monthly target progress',
    });
  }

  return insights;
};

const inventoryInsights = async (scope: LocationScope, today: string, settings: DashboardInsightSettings): Promise<DashboardInsight[]> => {
  const historyStart = addDays(today, -89);
  const thirtyDayStart = dayStart(addDays(today, -(settings.slowStockDays - 1)));
  const availableRows = await db.select({
    availableUnits: count(),
    oldestAvailableAt: sql<number>`min(${stock.latestAvailableDateTime})`,
    productId: products.id,
    productName: products.name,
  }).from(stock)
    .innerJoin(products, eq(products.id, stock.productId))
    .innerJoin(stockStatuses, eq(stockStatuses.id, stock.status))
    .where(and(
      eq(products.isActive, true),
      eq(stockStatuses.name, STOCK_STATUS.AVAILABLE),
      isNotNull(stock.productId),
      ...locationFilters(stock.locationId, scope),
    ))
    .groupBy(products.id, products.name);

  if (!availableRows.length) return [];

  const productSales = await db.select({
    lastSoldAt: sql<number | null>`max(${sales.timestamp})`,
    productId: saleItems.productId,
    saleCount: count(),
    units30: sql<number>`coalesce(sum(case when ${sales.timestamp} >= ${thirtyDayStart} then ${saleItems.quantity} else 0 end), 0)`,
    units90: sql<number>`coalesce(sum(${saleItems.quantity}), 0)`,
  }).from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .where(and(
      eq(sales.status, 'completed'),
      sql`${sales.timestamp} >= ${dayStart(historyStart)}`,
      ...locationFilters(sales.locationId, scope),
    ))
    .groupBy(saleItems.productId);

  const activity = new Map(productSales.map((row) => [row.productId, {
    lastSoldAt: row.lastSoldAt === null ? null : Number(row.lastSoldAt),
    saleCount: Number(row.saleCount),
    units30: Number(row.units30),
    units90: Number(row.units90),
  }]));
  const deadCutoff = dayStart(addDays(today, -settings.deadStockDays));
  const slowCutoff = dayStart(addDays(today, -settings.slowStockDays));
  const dead = availableRows.filter((row) => {
    const salesData = activity.get(row.productId);
    return Number(row.oldestAvailableAt) <= deadCutoff && (!salesData?.lastSoldAt || salesData.lastSoldAt <= deadCutoff);
  });
  const deadProductIds = new Set(dead.map(({ productId }) => productId));
  const slow = availableRows.filter((row) => {
    if (deadProductIds.has(row.productId)) return false;
    const salesData = activity.get(row.productId);
    if (Number(row.oldestAvailableAt) > slowCutoff) return false;
    if (!salesData?.lastSoldAt || salesData.lastSoldAt <= slowCutoff) return true;
    const dailyVelocity = salesData.units90 / 90;
    return dailyVelocity > 0 && Number(row.availableUnits) / dailyVelocity >= settings.excessStockCoverDays;
  });
  const stockout = availableRows.map((row) => {
    const salesData = activity.get(row.productId);
    const dailyVelocity = (salesData?.units30 ?? 0) / 30;
    return { ...row, daysCover: dailyVelocity > 0 ? Number(row.availableUnits) / dailyVelocity : Number.POSITIVE_INFINITY, saleCount: salesData?.saleCount ?? 0 };
  }).filter(({ daysCover }) => daysCover <= settings.stockoutCoverDays).sort((a, b) => a.daysCover - b.daysCover);
  const insights: DashboardInsight[] = [];

  if (dead.length) {
    const units = dead.reduce((total, row) => total + Number(row.availableUnits), 0);
    insights.push({
      action: 'Review pricing, promotion, stock transfer, or supplier return options before purchasing more.',
      confidence: 'high',
      domain: 'inventory',
      id: 'inventory-dead-stock',
      message: `${dead.length} products (${units} units) have had no sale for at least ${settings.deadStockDays} days. Highest attention: ${listNames(dead.map(({ productName }) => productName))}.`,
      metric: { format: 'number', label: 'Dead-stock units', value: units },
      period: `No completed sale for ${settings.deadStockDays}+ days`,
      severity: 'warning',
      title: 'Dead stock needs action',
    });
  }

  if (slow.length) {
    const units = slow.reduce((total, row) => total + Number(row.availableUnits), 0);
    insights.push({
      action: 'Check product placement and pricing, and avoid replenishment until stock velocity improves.',
      confidence: 'medium',
      domain: 'inventory',
      id: 'inventory-slow-moving',
      message: `${slow.length} products are moving slowly. Review ${listNames(slow.map(({ productName }) => productName))}.`,
      metric: { format: 'number', label: 'Slow-moving units', value: units },
      period: `${settings.slowStockDays}-day activity and ${settings.excessStockCoverDays}-day stock-cover rule`,
      severity: 'opportunity',
      title: 'Slow-moving stock opportunity',
    });
  }

  if (stockout.length) {
    const nearest = stockout[0];
    insights.push({
      action: 'Confirm supplier lead time and prepare replenishment for the listed fast-moving products.',
      confidence: confidenceFromSamples(stockout.reduce((total, row) => total + row.saleCount, 0)),
      domain: 'inventory',
      id: 'inventory-stockout-risk',
      message: `${stockout.length} products may run out within ${settings.stockoutCoverDays} days at the recent sales rate. Highest risk: ${listNames(stockout.map(({ productName }) => productName))}.`,
      metric: { format: 'number', label: 'Nearest days of stock', value: Math.max(Number(nearest.daysCover.toFixed(1)), 0) },
      period: 'Available stock vs last 30-day sales velocity',
      severity: nearest.daysCover <= 3 ? 'critical' : 'warning',
      title: 'Stockout risk detected',
    });
  }

  return insights;
};

const purchasingInsights = async (scope: LocationScope, today: string, settings: DashboardInsightSettings): Promise<DashboardInsight[]> => {
  const overdueRows = await db.select({
    balanceAmount: sql<string>`coalesce(sum(greatest(${supplierInvoices.totalAmount} - ${supplierInvoices.paidAmount}, 0)), 0)`,
    invoiceCount: count(),
    oldestDueDate: sql<number>`min(${supplierInvoices.dueDate})`,
    supplierId: suppliers.id,
    supplierName: suppliers.name,
  }).from(supplierInvoices)
    .innerJoin(suppliers, eq(suppliers.id, supplierInvoices.supplierId))
    .innerJoin(grns, eq(grns.id, supplierInvoices.grnId))
    .where(and(
      inArray(supplierInvoices.status, ['unpaid', 'partiallyPaid']),
      isNotNull(supplierInvoices.dueDate),
      sql`${supplierInvoices.dueDate} < ${dayStart(addDays(today, -(settings.overdueSupplierDays - 1)))}`,
      ...locationFilters(grns.locationId, scope),
    ))
    .groupBy(suppliers.id, suppliers.name)
    .orderBy(desc(sql`sum(greatest(${supplierInvoices.totalAmount} - ${supplierInvoices.paidAmount}, 0))`));

  if (!overdueRows.length) return [];
  const outstanding = money(overdueRows.reduce((total, row) => total + money(row.balanceAmount), 0));
  const invoiceCount = overdueRows.reduce((total, row) => total + Number(row.invoiceCount), 0);
  const oldestDueDate = Math.min(...overdueRows.map(({ oldestDueDate }) => Number(oldestDueDate)));
  const overdueDays = Math.max(Math.floor((dayStart(today) - oldestDueDate) / DAY_MS), 0);
  return [{
    action: 'Review the supplier invoice list, confirm payment status, and schedule the most overdue balances first.',
    confidence: 'rule',
    domain: 'purchasing',
    id: 'purchasing-overdue-suppliers',
    message: `${invoiceCount} invoices across ${overdueRows.length} suppliers are overdue. Highest attention: ${listNames(overdueRows.map(({ supplierName }) => supplierName))}.`,
    metric: { format: 'currency', label: 'Overdue balance', value: outstanding },
    period: `Oldest invoice is ${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`,
    severity: overdueDays >= 14 ? 'critical' : 'warning',
    title: 'Supplier payments are overdue',
  }];
};

const repairInsights = async (scope: LocationScope, now: number, settings: DashboardInsightSettings): Promise<DashboardInsight[]> => {
  const latestStageEntry = db.select({
    repairJobId: repairHistory.repairJobId,
    timestamp: sql<number>`max(${repairHistory.timestamp})`.as('stage_started_at'),
  }).from(repairHistory).groupBy(repairHistory.repairJobId).as('latest_repair_stage_entry');
  const stageStartedAt = sql<number>`coalesce(${latestStageEntry.timestamp}, ${repairJobs.timestamp})`;
  const delayedPredicate = or(
    and(eq(repairJobs.status, 'received'), sql`${stageStartedAt} <= ${now - settings.repairIntakeDays * DAY_MS}`),
    and(eq(repairJobs.status, 'inspection'), sql`${stageStartedAt} <= ${now - settings.repairIntakeDays * DAY_MS}`),
    and(eq(repairJobs.status, 'waitingParts'), sql`${stageStartedAt} <= ${now - settings.repairWaitingPartsDays * DAY_MS}`),
    and(eq(repairJobs.status, 'inProgress'), sql`${stageStartedAt} <= ${now - settings.repairInProgressDays * DAY_MS}`),
  );
  const rows = await db.select({
    oldestTimestamp: sql<number>`min(${stageStartedAt})`,
    status: repairJobs.status,
    total: count(),
  }).from(repairJobs)
    .leftJoin(latestStageEntry, eq(latestStageEntry.repairJobId, repairJobs.id))
    .where(and(delayedPredicate, ...locationFilters(repairJobs.locationId, scope)))
    .groupBy(repairJobs.status)
    .orderBy(desc(count()));

  if (!rows.length) return [];
  const delayedJobs = rows.reduce((total, row) => total + Number(row.total), 0);
  const oldestTimestamp = Math.min(...rows.map(({ oldestTimestamp }) => Number(oldestTimestamp)));
  const oldestDays = Math.max(Math.floor((now - oldestTimestamp) / DAY_MS), 0);
  const stages = rows.map(({ status, total }) => `${String(status).replace(/([a-z])([A-Z])/g, '$1 $2')} (${Number(total)})`).join(', ');
  return [{
    action: 'Open the repair queue, confirm ownership, and record the next customer update for delayed jobs.',
    confidence: 'rule',
    domain: 'repairs',
    id: 'repairs-delayed-active-jobs',
    message: `${delayedJobs} active repair jobs are beyond their stage attention window: ${stages}.`,
    metric: { format: 'number', label: 'Delayed jobs', value: delayedJobs },
    period: `Oldest delayed stage is ${oldestDays} days old`,
    severity: oldestDays >= 7 ? 'critical' : 'warning',
    title: 'Repair jobs need follow-up',
  }];
};

const severityOrder: Record<DashboardInsight['severity'], number> = {
  critical: 0,
  warning: 1,
  opportunity: 2,
  positive: 3,
};

export const getDashboardInsights = async (scope: LocationScope, visibility: InsightVisibility) => {
  const now = Date.now();
  const today = todayInColombo();
  const settings = await getDashboardInsightSettings();
  const cacheKey = JSON.stringify({ scope, settingsUpdatedAt: settings.updatedAt, today, visibility });
  const cached = insightCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.value;
  if (cached) insightCache.delete(cacheKey);

  const requests = [
    { domain: 'sales', promise: visibility.sales ? salesInsights(scope, today, settings) : Promise.resolve([]) },
    { domain: 'inventory', promise: visibility.inventory ? inventoryInsights(scope, today, settings) : Promise.resolve([]) },
    { domain: 'purchasing', promise: visibility.purchasing && visibility.purchasingCost ? purchasingInsights(scope, today, settings) : Promise.resolve([]) },
    { domain: 'repairs', promise: visibility.repairs ? repairInsights(scope, now, settings) : Promise.resolve([]) },
  ] as const;
  const results = await Promise.allSettled(requests.map(({ promise }) => promise));
  const hasFailures = results.some(({ status }) => status === 'rejected');
  const insights = results.flatMap((result, index) => {
    if (result.status === 'fulfilled') return result.value;
    logger.warn('Dashboard insight calculation failed.', {
      domain: requests[index]?.domain,
      error: result.reason instanceof Error ? result.reason.message : 'Unknown insight error',
    });
    return [];
  });

  const orderedInsights = insights
    .sort((left, right) => severityOrder[left.severity] - severityOrder[right.severity])
    .slice(0, 6);
  const scopeKey = scope === 'all' ? 'all' : String(scope);
  const actions = orderedInsights.length
    ? await db.select({ actionNote: dashboardInsightActions.note, actionState: dashboardInsightActions.state, actionedAt: dashboardInsightActions.timestamp, id: dashboardInsightActions.id, insightId: dashboardInsightActions.insightId })
      .from(dashboardInsightActions)
      .where(and(eq(dashboardInsightActions.scopeKey, scopeKey), inArray(dashboardInsightActions.insightId, orderedInsights.map(({ id }) => id))))
      .orderBy(desc(dashboardInsightActions.timestamp), desc(dashboardInsightActions.id))
    : [];
  const actionByInsightId = new Map<string, { actionNote: string | null; actionState: 'resolved' | 'dismissed'; actionedAt: number }>();
  actions.forEach((action) => {
    if (!actionByInsightId.has(action.insightId) && action.actionState !== 'open') {
      actionByInsightId.set(action.insightId, {
        actionNote: action.actionNote,
        actionState: action.actionState as 'resolved' | 'dismissed',
        actionedAt: action.actionedAt,
      });
    }
  });
  const enrichedInsights: DashboardInsight[] = orderedInsights.map((insight) => ({ ...insight, ...actionByInsightId.get(insight.id) }));
  if (!hasFailures) {
    if (insightCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = insightCache.keys().next().value;
      if (oldestKey) insightCache.delete(oldestKey);
    }
    insightCache.set(cacheKey, { expiresAt: now + INSIGHT_CACHE_TTL_MS, value: enrichedInsights });
  }
  return enrichedInsights;
};
