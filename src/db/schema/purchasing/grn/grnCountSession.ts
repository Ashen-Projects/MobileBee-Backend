import { bigint, boolean, index, int, mysqlEnum, mysqlTable, uniqueIndex } from 'drizzle-orm/mysql-core';

import { users } from '../../user/user';
import { grns } from './grn';

export const grnCountSessions = mysqlTable(
  'grn_count_sessions',
  {
    id: int('id').primaryKey().autoincrement(),
    grnId: int('grn_id').notNull().references(() => grns.id),
    countNumber: mysqlEnum('count_number', ['first', 'second']).notNull(),
    countedBy: int('counted_by').notNull().references(() => users.id),
    isMatched: boolean('is_matched').notNull(),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    uniqueIndex('grn_count_sessions_grn_count_uq').on(table.grnId, table.countNumber),
    index('grn_count_sessions_counted_by_idx').on(table.countedBy),
  ],
);
