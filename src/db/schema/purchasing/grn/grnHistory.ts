import { bigint, index, int, mysqlTable, text, varchar } from 'drizzle-orm/mysql-core';
import { users } from '../../user/user';
import { grns } from './grn';

export const grnHistory = mysqlTable(
  'grn_history',
  {
    id: int('id').primaryKey().autoincrement(),
    grnId: int('grn_id')
      .notNull()
      .references(() => grns.id),
    userId: int('user_id')
      .notNull()
      .references(() => users.id),
    previousStatus: varchar('previous_status', { length: 60 }),
    newStatus: varchar('new_status', { length: 60 }),
    action: varchar('action', { length: 100 }).notNull(),
    note: text('note'),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    index('grn_history_grn_id_idx').on(table.grnId),
    index('grn_history_new_status_idx').on(table.newStatus),
    index('grn_history_action_idx').on(table.action),
    index('grn_history_timestamp_idx').on(table.timestamp),
  ],
);
