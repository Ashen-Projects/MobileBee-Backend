import { bigint, index, int, mysqlTable, text, varchar } from 'drizzle-orm/mysql-core';
import { users } from '../user/user';
import { locations } from '../settings/location';
import { stockStatuses } from './stockStatus';
import { stock } from './stock';

export const stockLogs = mysqlTable(
  'stock_logs',
  {
    id: int('id').primaryKey().autoincrement(),
    stockId: int('stock_id')
      .notNull()
      .references(() => stock.id),
    action: varchar('action', { length: 100 }).notNull(),
    previousStatus: int('previous_status').references(() => stockStatuses.id),
    newStatus: int('new_status').references(() => stockStatuses.id),
    previousLocationId: int('previous_location_id').references(() => locations.id),
    newLocationId: int('new_location_id').references(() => locations.id),
    referenceType: varchar('reference_type', { length: 80 }),
    referenceId: int('reference_id'),
    userId: int('user_id')
      .notNull()
      .references(() => users.id),
    note: text('note'),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    index('stock_logs_stock_id_idx').on(table.stockId),
    index('stock_logs_action_idx').on(table.action),
    index('stock_logs_reference_idx').on(table.referenceType, table.referenceId),
    index('stock_logs_timestamp_idx').on(table.timestamp),
  ],
);
