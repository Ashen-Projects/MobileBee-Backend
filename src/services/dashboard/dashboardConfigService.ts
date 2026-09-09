import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';

import { db } from '../../db';
import { dashboardInsightSettings, dashboardTargets } from '../../db/schema';
import type { LocationScope } from '../shared/locationAccess';

export const DEFAULT_DASHBOARD_INSIGHT_SETTINGS: {
  deadStockDays: number;
  excessStockCoverDays: number;
  overdueSupplierDays: number;
  repairInProgressDays: number;
  repairIntakeDays: number;
  repairWaitingPartsDays: number;
  salesDeclinePercent: number;
  slowStockDays: number;
  stockoutCoverDays: number;
  suggestedTargetGrowthPercent: number;
} = {
  deadStockDays: 60,
  excessStockCoverDays: 90,
  overdueSupplierDays: 1,
  repairInProgressDays: 3,
  repairIntakeDays: 2,
  repairWaitingPartsDays: 5,
  salesDeclinePercent: 10,
  slowStockDays: 30,
  stockoutCoverDays: 7,
  suggestedTargetGrowthPercent: 10,
};

export type DashboardInsightSettings = typeof DEFAULT_DASHBOARD_INSIGHT_SETTINGS & { updatedAt: number };

const numberValue = (value: unknown) => Number(value ?? 0);

export const getDashboardInsightSettings = async (): Promise<DashboardInsightSettings> => {
  const [row] = await db.select().from(dashboardInsightSettings).limit(1);
  if (!row) return { ...DEFAULT_DASHBOARD_INSIGHT_SETTINGS, updatedAt: 0 };
  return {
    deadStockDays: row.deadStockDays,
    excessStockCoverDays: row.excessStockCoverDays,
    overdueSupplierDays: row.overdueSupplierDays,
    repairInProgressDays: row.repairInProgressDays,
    repairIntakeDays: row.repairIntakeDays,
    repairWaitingPartsDays: row.repairWaitingPartsDays,
    salesDeclinePercent: numberValue(row.salesDeclinePercent),
    slowStockDays: row.slowStockDays,
    stockoutCoverDays: row.stockoutCoverDays,
    suggestedTargetGrowthPercent: numberValue(row.suggestedTargetGrowthPercent),
    updatedAt: row.updatedAt,
  };
};

export const getActiveDashboardTarget = async (scope: LocationScope, period: 'weekly' | 'monthly', today: string) => {
  if (scope === 'all') return null;
  const [target] = await db.select({ id: dashboardTargets.id, targetAmount: dashboardTargets.targetAmount })
    .from(dashboardTargets)
    .where(and(
      eq(dashboardTargets.locationId, scope),
      eq(dashboardTargets.period, period),
      eq(dashboardTargets.isActive, true),
      lte(dashboardTargets.effectiveFrom, today),
      or(isNull(dashboardTargets.effectiveTo), gte(dashboardTargets.effectiveTo, today)),
    ))
    .orderBy(desc(dashboardTargets.effectiveFrom), desc(dashboardTargets.id))
    .limit(1);
  return target ? { id: target.id, targetAmount: numberValue(target.targetAmount) } : null;
};
