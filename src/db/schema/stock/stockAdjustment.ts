import { bigint, index, int, mysqlEnum, mysqlTable, text, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { users } from '../user/user';
import { locations } from '../settings/location';

export const stockAdjustments = mysqlTable(
  'stock_adjustments',
  {
    id: int('id').primaryKey().autoincrement(),
    adjustmentNo: varchar('adjustment_no', { length: 100 }).notNull(),
    locationId: int('location_id')
      .notNull()
      .references(() => locations.id),
    reason: text('reason').notNull(),
    status: mysqlEnum('status', ['draft', 'approved', 'declined']).notNull().default('draft'),
    createdBy: int('created_by')
      .notNull()
      .references(() => users.id),
    approvedBy: int('approved_by').references(() => users.id),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [uniqueIndex('stock_adjustments_adjustment_no_uq').on(table.adjustmentNo), index('stock_adjustments_status_idx').on(table.status)],
);
