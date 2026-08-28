import { bigint, decimal, index, int, mysqlEnum, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
import { users } from '../user/user';
import { repairJobs } from './repairJob';

export const repairPayments = mysqlTable(
  'repair_payments',
  {
    id: int('id').primaryKey().autoincrement(),
    repairJobId: int('repair_job_id')
      .notNull()
      .references(() => repairJobs.id),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    method: mysqlEnum('method', ['cash', 'card', 'bankTransfer', 'mobile']).notNull(),
    referenceNo: varchar('reference_no', { length: 255 }),
    receivedBy: int('received_by')
      .notNull()
      .references(() => users.id),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    index('repair_payments_repair_job_id_idx').on(table.repairJobId),
    index('repair_payments_method_idx').on(table.method),
    index('repair_payments_timestamp_idx').on(table.timestamp),
  ],
);
