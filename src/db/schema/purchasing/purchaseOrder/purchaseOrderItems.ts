import { bigint, decimal, index, int, mysqlTable, uniqueIndex } from 'drizzle-orm/mysql-core';
import { products } from '../../product/product';
import { supplierProducts } from '../supplier/supplierProduct';
import { purchaseOrders } from './purchaseOrder';

export const purchaseOrderItems = mysqlTable(
  'purchase_order_items',
  {
    id: int('id').primaryKey().autoincrement(),
    purchaseOrderId: int('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id),
    supplierProductId: int('supplier_product_id')
      .notNull()
      .references(() => supplierProducts.id),
    productId: int('product_id')
      .notNull()
      .references(() => products.id),
    quantity: int('quantity').notNull(),
    receivedQuantity: int('received_quantity').notNull().default(0),
    unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
    totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    uniqueIndex('purchase_order_items_po_supplier_product_uq').on(table.purchaseOrderId, table.supplierProductId),
    index('purchase_order_items_product_id_idx').on(table.productId),
  ],
);
