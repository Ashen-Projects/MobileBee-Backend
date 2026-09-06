import { bigint, decimal, index, int, mysqlEnum, mysqlTable, text, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { users } from '../user/user';
import { locations } from '../settings/location';
import { customers } from '../customer/customer';

export const repairJobs = mysqlTable(
  'repair_jobs',
  {
    id: int('id').primaryKey().autoincrement(),
    jobNo: varchar('job_no', { length: 100 }).notNull(),
    publicStatusToken: varchar('public_status_token', { length: 128 }).notNull(),
    customerId: int('customer_id')
      .notNull()
      .references(() => customers.id),
    locationId: int('location_id')
      .notNull()
      .references(() => locations.id),
    addedBy: int('added_by')
      .notNull()
      .references(() => users.id),
    assignedTo: int('assigned_to').references(() => users.id),
    deviceName: varchar('device_name', { length: 255 }).notNull(),
    serialImei: varchar('serial_imei', { length: 255 }),
    problemDescription: text('problem_description').notNull(),
    status: mysqlEnum('status', [
      'received',
      'inspection',
      'waitingParts',
      'inProgress',
      'completed',
      'delivered',
      'cancelled',
    ])
      .notNull()
      .default('received'),
    estimatedCost: decimal('estimated_cost', { precision: 12, scale: 2 }).default('0.00'),
    finalCost: decimal('final_cost', { precision: 12, scale: 2 }).default('0.00'),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    uniqueIndex('repair_jobs_job_no_uq').on(table.jobNo),
    uniqueIndex('repair_jobs_public_status_token_uq').on(table.publicStatusToken),
    index('repair_jobs_serial_imei_idx').on(table.serialImei),
    index('repair_jobs_status_idx').on(table.status),
    index('repair_jobs_timestamp_idx').on(table.timestamp),
  ],
);
