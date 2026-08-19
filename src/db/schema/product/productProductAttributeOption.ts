import { bigint, foreignKey, int, mysqlTable, primaryKey } from 'drizzle-orm/mysql-core';
import { productAttributeOptions } from './productAttributeOption';
import { products } from './product';

export const productProductAttributeOptions = mysqlTable(
  'product_product_attribute_options',
  {
    productId: int('product_id').notNull(),
    optionId: int('option_id').notNull(),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.optionId] }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [products.id],
      name: 'ppao_product_fk',
    }),
    foreignKey({
      columns: [table.optionId],
      foreignColumns: [productAttributeOptions.id],
      name: 'ppao_option_fk',
    }),
  ],
);
