import { bigint, boolean, index, int, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
import { products } from './product';

export const productImages = mysqlTable(
  'product_images',
  {
    id: int('id').primaryKey().autoincrement(),
    productId: int('product_id')
      .notNull()
      .references(() => products.id),
    url: varchar('url', { length: 1024 }).notNull(),
    altText: varchar('alt_text', { length: 255 }),
    priority: int('priority').notNull().default(0),
    isPrimary: boolean('is_primary').notNull().default(false),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [index('product_images_product_id_idx').on(table.productId)],
);
