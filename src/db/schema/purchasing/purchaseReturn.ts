import { bigint, decimal, index, int, mysqlEnum, mysqlTable, text, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { users } from '../user/user';
import { locations } from '../settings/location';
import { suppliers } from './supplier/supplier';
import { grns } from './grn/grn';

export const purchaseReturns = mysqlTable(
  'purchase_returns',
  {
    id: int('id').primaryKey().autoincrement(),
    returnNo: varchar('return_no', { length: 100 }).notNull(),
    supplierId: int('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    grnId: int('grn_id').references(() => grns.id),
    locationId: int('location_id')
      .notNull()
      .references(() => locations.id),
    status: mysqlEnum('status', ['draft', 'approved', 'dispatched', 'credited', 'cancelled']).notNull().default('draft'),
    totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
    reason: text('reason').notNull(),
    createdBy: int('created_by')
      .notNull()
      .references(() => users.id),
    approvedBy: int('approved_by').references(() => users.id),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [uniqueIndex('purchase_returns_return_no_uq').on(table.returnNo), index('purchase_returns_status_idx').on(table.status)],
);
