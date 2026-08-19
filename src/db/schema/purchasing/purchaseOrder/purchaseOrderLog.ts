import { bigint, foreignKey, index, int, mysqlTable, text, varchar } from 'drizzle-orm/mysql-core';
import { users } from '../../user/user';
import { purchaseOrderStatuses } from './purchaseOrderStatus';
import { purchaseOrders } from './purchaseOrder';

export const purchaseOrderLogs = mysqlTable(
  'purchase_order_logs',
  {
    id: int('id').primaryKey().autoincrement(),
    purchaseOrderId: int('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id),
    userId: int('user_id')
      .notNull()
      .references(() => users.id),
    previousStatus: int('previous_status'),
    newStatus: int('new_status').references(() => purchaseOrderStatuses.id),
    action: varchar('action', { length: 100 }).notNull(),
    note: text('note'),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.previousStatus],
      foreignColumns: [purchaseOrderStatuses.id],
      name: 'po_logs_previous_status_fk',
    }),
    index('purchase_order_logs_purchase_order_id_idx').on(table.purchaseOrderId),
    index('purchase_order_logs_action_idx').on(table.action),
    index('purchase_order_logs_timestamp_idx').on(table.timestamp),
  ],
);
