import { bigint, decimal, index, int, mysqlEnum, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { users } from '../user/user';
import { locations } from '../settings/location';
import { customers } from '../customer/customer';
import { posDrawers } from './drawer';

export const sales = mysqlTable(
  'sales',
  {
    id: int('id').primaryKey().autoincrement(),
    invoiceNo: varchar('invoice_no', { length: 100 }).notNull(),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
    locationId: int('location_id')
      .notNull()
      .references(() => locations.id),
    customerId: int('customer_id').references(() => customers.id),
    userId: int('user_id')
      .notNull()
      .references(() => users.id),
    drawerId: int('drawer_id').references(() => posDrawers.id),
    subTotal: decimal('sub_total', { precision: 12, scale: 2 }).notNull(),
    discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
    // An administrator must document any exception to the standard product price policy.
    // Keeping it on the sale preserves the approval context for future audits and reprints.
    priceOverrideReason: varchar('price_override_reason', { length: 500 }),
    totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
    paidAmount: decimal('paid_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
    status: mysqlEnum('status', ['draft', 'completed', 'cancelled', 'returned']).notNull().default('completed'),
  },
  (table) => [
    uniqueIndex('sales_invoice_no_uq').on(table.invoiceNo),
    index('sales_timestamp_idx').on(table.timestamp),
    index('sales_status_idx').on(table.status),
    index('sales_drawer_id_idx').on(table.drawerId),
  ],
);
