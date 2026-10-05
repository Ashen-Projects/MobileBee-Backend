import { decimal, index, int, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
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
    // Warranty terms are copied from the product at the time of sale. Product settings
    // can change later, but a customer's invoice must retain the original entitlement.
    warrantyType: varchar('warranty_type', { length: 32 }),
    warrantyPeriodMonths: int('warranty_period_months'),
    quantity: int('quantity').notNull(),
    unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
    discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
    totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  },
  (table) => [index('sale_items_sale_id_idx').on(table.saleId), index('sale_items_product_id_idx').on(table.productId)],
);
