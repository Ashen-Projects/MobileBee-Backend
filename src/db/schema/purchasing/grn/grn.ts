import { bigint, decimal, index, int, mysqlEnum, mysqlTable } from 'drizzle-orm/mysql-core';
import { users } from '../../user/user';
import { locations } from '../../settings/location';
import { suppliers } from '../supplier/supplier';
import { purchaseOrders } from '../purchaseOrder/purchaseOrder';

export const grns = mysqlTable(
  'grns',
  {
    id: int('id').primaryKey().autoincrement(),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
    locationId: int('location_id').references(() => locations.id),
    purchaseOrderId: int('purchase_order_id').references(() => purchaseOrders.id),
    supplierId: int('supplier_id').references(() => suppliers.id),
    addedBy: int('added_by').references(() => users.id),
    countedBy: int('counted_by').references(() => users.id),
    counted2By: int('counted2_by').references(() => users.id),
    financeApprovedBy: int('finance_approved_by').references(() => users.id),
    status: mysqlEnum('status', ['pendingCountApproval', 'pendingFinanceApproval', 'approved', 'declined']).default(
      'pendingCountApproval',
    ),
    costTotal: decimal('cost_total', { precision: 12, scale: 2 }).default('0.00'),
    paymentStatus: mysqlEnum('payment_status', ['unpaid', 'partiallyPaid', 'paid']).default('unpaid'),
    paidAmount: decimal('paid_amount', { precision: 12, scale: 2 }).default('0.00'),
  },
  (table) => [
    index('grns_location_id_idx').on(table.locationId),
    index('grns_purchase_order_id_idx').on(table.purchaseOrderId),
    index('grns_supplier_id_idx').on(table.supplierId),
    index('grns_status_idx').on(table.status),
    index('grns_po_status_timestamp_idx').on(table.purchaseOrderId, table.status, table.timestamp),
  ],
);
