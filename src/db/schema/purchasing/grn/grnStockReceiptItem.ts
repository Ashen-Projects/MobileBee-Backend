import { decimal, int, mysqlTable, varchar } from 'drizzle-orm/mysql-core';

import { products } from '../../product/product';
import { grnItems } from './grnItem';
import { grnStockReceipts } from './grnStockReceipt';

/** Immutable product and price snapshot for one line on a stock receiving note. */
export const grnStockReceiptItems = mysqlTable(
  'grn_stock_receipt_items',
  {
    id: int('id').primaryKey().autoincrement(),
    stockReceiptId: int('stock_receipt_id').notNull().references(() => grnStockReceipts.id),
    grnItemId: int('grn_item_id').notNull().references(() => grnItems.id),
    productId: int('product_id').notNull().references(() => products.id),
    productName: varchar('product_name', { length: 500 }).notNull(),
    productSku: varchar('product_sku', { length: 100 }),
    quantity: int('quantity').notNull(),
    unitCost: decimal('unit_cost', { precision: 10, scale: 2 }).notNull(),
    mrpPrice: decimal('mrp_price', { precision: 10, scale: 2 }).notNull(),
  },
);
