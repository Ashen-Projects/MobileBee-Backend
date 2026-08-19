import { bigint, decimal, index, int, mysqlTable } from 'drizzle-orm/mysql-core';
import { users } from '../../user/user';
import { locations } from '../../settings/location';
import { suppliers } from '../supplier/supplier';
import { purchaseOrderStatuses } from './purchaseOrderStatus';

export const purchaseOrders = mysqlTable(
  'purchase_orders',
  {
    id: int('id').primaryKey().autoincrement(),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
    supplierId: int('supplier_id').references(() => suppliers.id),
    totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
    status: int('status')
      .default(1)
      .references(() => purchaseOrderStatuses.id),
    locationId: int('location_id').references(() => locations.id),
    userId: int('user_id').references(() => users.id),
  },
  (table) => [
    index('purchase_orders_supplier_id_idx').on(table.supplierId),
    index('purchase_orders_status_idx').on(table.status),
    index('purchase_orders_location_id_idx').on(table.locationId),
    index('purchase_orders_user_id_idx').on(table.userId),
    index('purchase_orders_supplier_status_timestamp_idx').on(table.supplierId, table.status, table.timestamp),
  ],
);
