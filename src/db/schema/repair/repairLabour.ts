import { bigint, decimal, index, int, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
import { users } from '../user/user';
import { repairJobs } from './repairJob';

export const repairLabour = mysqlTable(
  'repair_labour',
  {
    id: int('id').primaryKey().autoincrement(),
    repairJobId: int('repair_job_id')
      .notNull()
      .references(() => repairJobs.id),
    description: varchar('description', { length: 255 }).notNull(),
    technicianId: int('technician_id').references(() => users.id),
    hours: decimal('hours', { precision: 6, scale: 2 }),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [index('repair_labour_repair_job_id_idx').on(table.repairJobId)],
);
