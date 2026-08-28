import { bigint, index, int, mysqlEnum, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { users } from '../user/user';
import { locations } from '../settings/location';

export const stockTransfers = mysqlTable(
  'stock_transfers',
  {
    id: int('id').primaryKey().autoincrement(),
    transferNo: varchar('transfer_no', { length: 100 }).notNull(),
    fromLocationId: int('from_location_id')
      .notNull()
      .references(() => locations.id),
    toLocationId: int('to_location_id')
      .notNull()
      .references(() => locations.id),
    status: mysqlEnum('status', ['draft', 'dispatched', 'received', 'cancelled']).notNull().default('draft'),
    createdBy: int('created_by')
      .notNull()
      .references(() => users.id),
    dispatchedBy: int('dispatched_by').references(() => users.id),
    receivedBy: int('received_by').references(() => users.id),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [uniqueIndex('stock_transfers_transfer_no_uq').on(table.transferNo), index('stock_transfers_status_idx').on(table.status)],
);
