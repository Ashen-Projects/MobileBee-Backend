import { bigint, decimal, index, int, mysqlEnum, mysqlTable, text, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { users } from '../user/user';
import { locations } from '../settings/location';
import { customers } from '../customer/customer';
import { sales } from './sale';

export const saleReturns = mysqlTable(
  'sale_returns',
  {
    id: int('id').primaryKey().autoincrement(),
    returnNo: varchar('return_no', { length: 100 }).notNull(),
    saleId: int('sale_id')
      .notNull()
      .references(() => sales.id),
    locationId: int('location_id')
      .notNull()
      .references(() => locations.id),
    customerId: int('customer_id').references(() => customers.id),
    status: mysqlEnum('status', ['pending', 'approved', 'rejected', 'refunded']).notNull().default('pending'),
    totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
    reason: text('reason').notNull(),
    createdBy: int('created_by')
      .notNull()
      .references(() => users.id),
    approvedBy: int('approved_by').references(() => users.id),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [uniqueIndex('sale_returns_return_no_uq').on(table.returnNo), index('sale_returns_status_idx').on(table.status)],
);
