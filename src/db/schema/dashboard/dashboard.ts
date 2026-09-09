import { bigint, boolean, date, decimal, index, int, mysqlEnum, mysqlTable, text, varchar } from 'drizzle-orm/mysql-core';

import { locations } from '../settings/location';
import { users } from '../user/user';

export const dashboardTargets = mysqlTable(
  'dashboard_targets',
  {
    id: int('id').primaryKey().autoincrement(),
    locationId: int('location_id').notNull().references(() => locations.id),
    period: mysqlEnum('period', ['weekly', 'monthly']).notNull(),
    targetAmount: decimal('target_amount', { precision: 14, scale: 2 }).notNull(),
    effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
    effectiveTo: date('effective_to', { mode: 'string' }),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: int('created_by').notNull().references(() => users.id),
    updatedBy: int('updated_by').notNull().references(() => users.id),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
    updatedAt: bigint('updated_at', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    index('dashboard_targets_location_period_idx').on(table.locationId, table.period),
    index('dashboard_targets_active_idx').on(table.isActive),
    index('dashboard_targets_effective_idx').on(table.effectiveFrom, table.effectiveTo),
  ],
);

export const dashboardInsightSettings = mysqlTable('dashboard_insight_settings', {
  id: int('id').primaryKey().autoincrement(),
  deadStockDays: int('dead_stock_days').notNull().default(60),
  slowStockDays: int('slow_stock_days').notNull().default(30),
  excessStockCoverDays: int('excess_stock_cover_days').notNull().default(90),
  stockoutCoverDays: int('stockout_cover_days').notNull().default(7),
  salesDeclinePercent: decimal('sales_decline_percent', { precision: 5, scale: 2 }).notNull().default('10.00'),
  suggestedTargetGrowthPercent: decimal('suggested_target_growth_percent', { precision: 5, scale: 2 }).notNull().default('10.00'),
  overdueSupplierDays: int('overdue_supplier_days').notNull().default(1),
  repairIntakeDays: int('repair_intake_days').notNull().default(2),
  repairWaitingPartsDays: int('repair_waiting_parts_days').notNull().default(5),
  repairInProgressDays: int('repair_in_progress_days').notNull().default(3),
  updatedBy: int('updated_by').notNull().references(() => users.id),
  updatedAt: bigint('updated_at', { mode: 'number', unsigned: true }).notNull(),
});

export const dashboardInsightActions = mysqlTable(
  'dashboard_insight_actions',
  {
    id: int('id').primaryKey().autoincrement(),
    insightId: varchar('insight_id', { length: 120 }).notNull(),
    scopeKey: varchar('scope_key', { length: 32 }).notNull(),
    locationId: int('location_id').references(() => locations.id),
    state: mysqlEnum('state', ['open', 'resolved', 'dismissed']).notNull().default('open'),
    note: text('note'),
    actedBy: int('acted_by').notNull().references(() => users.id),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    index('dashboard_insight_actions_insight_idx').on(table.insightId),
    index('dashboard_insight_actions_location_idx').on(table.locationId),
    index('dashboard_insight_actions_timestamp_idx').on(table.timestamp),
    index('dashboard_insight_actions_scope_history_idx').on(table.scopeKey, table.insightId, table.timestamp),
  ],
);
