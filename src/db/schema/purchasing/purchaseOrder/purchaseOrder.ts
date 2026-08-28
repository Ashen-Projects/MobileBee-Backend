import { bigint, decimal, index, int, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { users } from '../../user/user';
import { locations } from '../../settings/location';
import { suppliers } from '../supplier/supplier';
import { purchaseOrderStatuses } from './purchaseOrderStatus';

export const purchaseOrders = mysqlTable(
  'purchase_orders',
  {
    id: int('id').primaryKey().autoincrement(),
    poNumber: varchar('po_number', { length: 100 }).notNull(),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
    supplierId: int('supplier_id').notNull().references(() => suppliers.id),
    totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
    status: int('status')
      .notNull()
      .references(() => purchaseOrderStatuses.id),
    locationId: int('location_id').notNull().references(() => locations.id),
    userId: int('user_id').notNull().references(() => users.id),
  },
  (table) => [
    uniqueIndex('purchase_orders_po_number_uq').on(table.poNumber),
    index('purchase_orders_supplier_id_idx').on(table.supplierId),
    index('purchase_orders_status_idx').on(table.status),
    index('purchase_orders_location_id_idx').on(table.locationId),
    index('purchase_orders_user_id_idx').on(table.userId),
    index('purchase_orders_supplier_status_timestamp_idx').on(table.supplierId, table.status, table.timestamp),
  ],
);
