import { bigint, index, int, mysqlEnum, mysqlTable, text, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { users } from '../user/user';
import { locations } from '../settings/location';

export const stockAdjustments = mysqlTable(
  'stock_adjustments',
  {
    id: int('id').primaryKey().autoincrement(),
    adjustmentNo: varchar('adjustment_no', { length: 100 }).notNull(),
    adjustmentType: varchar('adjustment_type', { length: 32 }).notNull().default('general'),
    locationId: int('location_id')
      .notNull()
      .references(() => locations.id),
    reason: text('reason').notNull(),
    decisionNote: varchar('decision_note', { length: 512 }),
    status: mysqlEnum('status', ['draft', 'approved', 'declined']).notNull().default('draft'),
    createdBy: int('created_by')
      .notNull()
      .references(() => users.id),
    approvedBy: int('approved_by').references(() => users.id),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    uniqueIndex('stock_adjustments_adjustment_no_uq').on(table.adjustmentNo),
    index('stock_adjustments_status_idx').on(table.status),
    index('stock_adjustments_type_location_time_idx').on(table.adjustmentType, table.locationId, table.timestamp),
  ],
);
