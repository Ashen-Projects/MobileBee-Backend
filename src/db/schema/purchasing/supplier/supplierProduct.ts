import { bigint, boolean, decimal, index, int, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { products } from '../../product/product';
import { suppliers } from './supplier';

export const supplierProducts = mysqlTable(
  'supplier_products',
  {
    id: int('id').primaryKey().autoincrement(),
    supplierId: int('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    productId: int('product_id')
      .notNull()
      .references(() => products.id),
    supplierProductCode: varchar('supplier_product_code', { length: 255 }),
    supplierProductName: varchar('supplier_product_name', { length: 255 }),
    lastPurchasingPrice: decimal('last_purchasing_price', { precision: 10, scale: 2 }),
    quotedPrice: decimal('quoted_price', { precision: 10, scale: 2 }),
    minimumOrderQty: int('minimum_order_qty').notNull().default(1),
    leadTimeDays: int('lead_time_days'),
    isPreferred: boolean('is_preferred').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    uniqueIndex('supplier_products_supplier_product_uq').on(table.supplierId, table.productId),
    index('supplier_products_code_idx').on(table.supplierProductCode),
    index('supplier_products_is_preferred_idx').on(table.isPreferred),
    index('supplier_products_is_active_idx').on(table.isActive),
  ],
);
