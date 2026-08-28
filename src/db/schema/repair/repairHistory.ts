import { bigint, index, int, mysqlTable, text, varchar } from 'drizzle-orm/mysql-core';
import { users } from '../user/user';
import { repairJobs } from './repairJob';

export const repairHistory = mysqlTable(
  'repair_history',
  {
    id: int('id').primaryKey().autoincrement(),
    repairJobId: int('repair_job_id')
      .notNull()
      .references(() => repairJobs.id),
    userId: int('user_id')
      .notNull()
      .references(() => users.id),
    oldStatus: varchar('old_status', { length: 80 }),
    newStatus: varchar('new_status', { length: 80 }).notNull(),
    note: text('note'),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    index('repair_history_repair_job_id_idx').on(table.repairJobId),
    index('repair_history_new_status_idx').on(table.newStatus),
    index('repair_history_timestamp_idx').on(table.timestamp),
  ],
);
