import { and, asc, desc, eq } from 'drizzle-orm';

import { db } from '../../db';
import { auditLogs, dashboardInsightActions, dashboardInsightSettings, dashboardTargets, locations, users } from '../../db/schema';
import { AppError } from '../../errors/app-error';
import type { AuthenticatedUser } from '../auth/authService';
import { isAdministrator, resolveLocationScope } from '../shared/locationAccess';
import { DEFAULT_DASHBOARD_INSIGHT_SETTINGS, getDashboardInsightSettings } from './dashboardConfigService';
import { dashboardInsightActionSchema, dashboardInsightIdSchema, dashboardInsightSettingsSchema, dashboardTargetSchema } from './dashboardControlsValidation';
import { clearDashboardInsightCache } from './dashboardInsightService';

type AuditContext = { ipAddress?: string };
const previousDate = (date: string) => new Date(Date.parse(`${date}T00:00:00.000Z`) - 86_400_000).toISOString().slice(0, 10);
const todayInColombo = () => {
  const parts = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Colombo', year: 'numeric' }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${value.year}-${value.month}-${value.day}`;
};

const audit = (user: AuthenticatedUser, context: AuditContext, action: string, entityType: string, entityId: number, oldValues?: unknown, newValues?: unknown) => ({
  action,
  entityId,
  entityType,
  ipAddress: context.ipAddress,
  module: 'dashboard',
  newValues,
  oldValues,
  timestamp: Date.now(),
  userId: user.id,
});

export const getDashboardControls = async (user: AuthenticatedUser) => {
  const scope = isAdministrator(user) ? 'all' : await resolveLocationScope('all', user);
  const targetScopeFilter = scope === 'all' ? undefined : eq(dashboardTargets.locationId, scope);
  const actionScopeFilter = scope === 'all' ? undefined : eq(dashboardInsightActions.locationId, scope);
  const [settings, targets, insightActions] = await Promise.all([
    getDashboardInsightSettings(),
    db.select({
      createdBy: users.displayName,
      effectiveFrom: dashboardTargets.effectiveFrom,
      effectiveTo: dashboardTargets.effectiveTo,
      id: dashboardTargets.id,
      isActive: dashboardTargets.isActive,
      locationId: dashboardTargets.locationId,
      locationName: locations.name,
      period: dashboardTargets.period,
      targetAmount: dashboardTargets.targetAmount,
      updatedAt: dashboardTargets.updatedAt,
    }).from(dashboardTargets)
      .innerJoin(locations, eq(locations.id, dashboardTargets.locationId))
      .innerJoin(users, eq(users.id, dashboardTargets.createdBy))
      .where(targetScopeFilter)
      .orderBy(asc(locations.name), asc(dashboardTargets.period), desc(dashboardTargets.isActive), desc(dashboardTargets.effectiveFrom)),
    db.select({
      actedBy: users.displayName,
      actedByUserId: dashboardInsightActions.actedBy,
      id: dashboardInsightActions.id,
      insightId: dashboardInsightActions.insightId,
      locationId: dashboardInsightActions.locationId,
      locationName: locations.name,
      note: dashboardInsightActions.note,
      scopeKey: dashboardInsightActions.scopeKey,
      state: dashboardInsightActions.state,
      timestamp: dashboardInsightActions.timestamp,
    }).from(dashboardInsightActions)
      .leftJoin(locations, eq(locations.id, dashboardInsightActions.locationId))
      .innerJoin(users, eq(users.id, dashboardInsightActions.actedBy))
      .where(actionScopeFilter)
      .orderBy(desc(dashboardInsightActions.timestamp), desc(dashboardInsightActions.id))
      .limit(50),
  ]);
  return {
    defaults: DEFAULT_DASHBOARD_INSIGHT_SETTINGS,
    insightActions,
    settings,
    targets: targets.map((target) => ({ ...target, targetAmount: Number(target.targetAmount) })),
  };
};

export const saveDashboardTarget = async (input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const data = dashboardTargetSchema.parse(input);
  if (data.effectiveFrom < todayInColombo()) {
    throw new AppError('Targets cannot be backdated because historical sales reporting is protected.', 400);
  }
  const locationScope = await resolveLocationScope(data.locationId, user);
  if (locationScope === 'all') throw new AppError('A target must belong to one location.', 400);
  const locationId = locationScope;
  const [location] = await db.select({ id: locations.id, isActive: locations.isActive }).from(locations)
    .where(eq(locations.id, locationId)).limit(1);
  if (!location) throw new AppError('Location not found.', 404);
  if (!location.isActive) throw new AppError('Targets can only be set for an active location.', 400);

  const timestamp = Date.now();
  const id = await db.transaction(async (transaction) => {
    const matchingStart = await transaction.select().from(dashboardTargets).where(and(
      eq(dashboardTargets.locationId, locationId),
      eq(dashboardTargets.period, data.period),
      eq(dashboardTargets.isActive, true),
      eq(dashboardTargets.effectiveFrom, data.effectiveFrom),
    )).limit(1);
    if (matchingStart[0]) {
      await transaction.update(dashboardTargets).set({ targetAmount: String(data.targetAmount), updatedAt: timestamp, updatedBy: user.id })
        .where(eq(dashboardTargets.id, matchingStart[0].id));
      await transaction.insert(auditLogs).values(audit(user, context, 'update_target', 'dashboard_target', matchingStart[0].id, matchingStart[0], data));
      return matchingStart[0].id;
    }

    const openTargets = await transaction.select().from(dashboardTargets).where(and(
      eq(dashboardTargets.locationId, locationId),
      eq(dashboardTargets.period, data.period),
      eq(dashboardTargets.isActive, true),
    ));
    const previousOpenTarget = openTargets
      .filter((target) => target.effectiveFrom < data.effectiveFrom && (!target.effectiveTo || target.effectiveTo >= data.effectiveFrom))
      .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0];
    const nextOpenTarget = openTargets
      .filter((target) => target.effectiveFrom > data.effectiveFrom)
      .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))[0];
    if (previousOpenTarget) {
      await transaction.update(dashboardTargets).set({ effectiveTo: previousDate(data.effectiveFrom), updatedAt: timestamp, updatedBy: user.id })
        .where(eq(dashboardTargets.id, previousOpenTarget.id));
    }
    const result = await transaction.insert(dashboardTargets).values({
      createdBy: user.id,
      effectiveFrom: data.effectiveFrom,
      effectiveTo: nextOpenTarget ? previousDate(nextOpenTarget.effectiveFrom) : null,
      locationId,
      period: data.period,
      targetAmount: String(data.targetAmount),
      timestamp,
      updatedAt: timestamp,
      updatedBy: user.id,
    });
    const id = Number(result[0].insertId);
    await transaction.insert(auditLogs).values(audit(user, context, 'set_target', 'dashboard_target', id, previousOpenTarget, data));
    return id;
  });
  clearDashboardInsightCache();
  return id;
};

export const saveDashboardInsightSettings = async (input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const data = dashboardInsightSettingsSchema.parse(input);
  const timestamp = Date.now();
  const current = await getDashboardInsightSettings();
  await db.transaction(async (transaction) => {
    const [existing] = await transaction.select({ id: dashboardInsightSettings.id }).from(dashboardInsightSettings).limit(1);
    const values = { ...data, salesDeclinePercent: String(data.salesDeclinePercent), suggestedTargetGrowthPercent: String(data.suggestedTargetGrowthPercent), updatedAt: timestamp, updatedBy: user.id };
    if (existing) await transaction.update(dashboardInsightSettings).set(values).where(eq(dashboardInsightSettings.id, existing.id));
    else await transaction.insert(dashboardInsightSettings).values(values);
    await transaction.insert(auditLogs).values(audit(user, context, 'update_insight_settings', 'dashboard_insight_settings', existing?.id ?? 1, current, data));
  });
  clearDashboardInsightCache();
  return getDashboardInsightSettings();
};

export const saveDashboardInsightAction = async (insightIdInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const insightId = dashboardInsightIdSchema.parse(insightIdInput);
  const data = dashboardInsightActionSchema.parse(input);
  const scope = data.locationId === 'all'
    ? (isAdministrator(user) ? 'all' : (() => { throw new AppError('You do not have access to all locations.', 403); })())
    : await resolveLocationScope(data.locationId, user);
  const timestamp = Date.now();
  const locationId = scope === 'all' ? null : scope;
  const scopeKey = scope === 'all' ? 'all' : String(scope);
  await db.transaction(async (transaction) => {
    const result = await transaction.insert(dashboardInsightActions).values({
      actedBy: user.id,
      insightId,
      locationId,
      note: data.note || null,
      scopeKey,
      state: data.state,
      timestamp,
    });
    const actionId = Number(result[0].insertId);
    await transaction.insert(auditLogs).values(audit(
      user,
      context,
      data.state,
      'dashboard_insight_action',
      actionId,
      undefined,
      { insightId, locationId, note: data.note, scopeKey, state: data.state },
    ));
  });
  clearDashboardInsightCache();
};
