import { boolean, index, int, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
export const productCategories = mysqlTable(
  'product_categories',
  {
    id: int('id').primaryKey().autoincrement(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    parentId: int('parent_id'),
    priority: int('priority').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    uniqueIndex('product_categories_slug_uq').on(table.slug),
    uniqueIndex('product_categories_name_parent_uq').on(table.name, table.parentId),
    index('product_categories_parent_id_idx').on(table.parentId),
    index('product_categories_is_active_idx').on(table.isActive),
  ],
);
