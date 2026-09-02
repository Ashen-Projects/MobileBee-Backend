import { decimal, index, int, mysqlTable, uniqueIndex } from 'drizzle-orm/mysql-core';

import { products } from '../../product/product';
import { purchaseOrderItems } from '../purchaseOrder/purchaseOrderItems';
import { grns } from './grn';

export const grnItems = mysqlTable(
  'grn_items',
  {
    id: int('id').primaryKey().autoincrement(),
    grnId: int('grn_id').notNull().references(() => grns.id),
    purchaseOrderItemId: int('purchase_order_item_id').notNull().references(() => purchaseOrderItems.id),
    productId: int('product_id').notNull().references(() => products.id),
    quantity: int('quantity').notNull(),
    stockedQuantity: int('stocked_quantity').notNull().default(0),
    unitCost: decimal('unit_cost', { precision: 10, scale: 2 }).notNull(),
    totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  },
  (table) => [
    uniqueIndex('grn_items_grn_po_item_uq').on(table.grnId, table.purchaseOrderItemId),
    index('grn_items_po_item_idx').on(table.purchaseOrderItemId),
    index('grn_items_product_idx').on(table.productId),
  ],
);
