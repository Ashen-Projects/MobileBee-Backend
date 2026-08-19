import { decimal, index, int, mysqlTable } from 'drizzle-orm/mysql-core';
import { products } from '../product/product';
import { sales } from './sale';

export const saleItems = mysqlTable(
  'sale_items',
  {
    id: int('id').primaryKey().autoincrement(),
    saleId: int('sale_id')
      .notNull()
      .references(() => sales.id),
    productId: int('product_id')
      .notNull()
      .references(() => products.id),
    quantity: int('quantity').notNull(),
    unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
    discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
    totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  },
  (table) => [index('sale_items_sale_id_idx').on(table.saleId), index('sale_items_product_id_idx').on(table.productId)],
);
