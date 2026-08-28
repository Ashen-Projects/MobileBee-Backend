import { boolean, index, int, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { seo } from './seo';
export const productCategories = mysqlTable(
  'product_categories',
  {
    id: int('id').primaryKey().autoincrement(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    description: varchar('description', { length: 1024 }),
    iconUrl: varchar('icon_url', { length: 1024 }),
    logoUrl: varchar('logo_url', { length: 1024 }),
    parentId: int('parent_id'),
    seoId: int('seo_id').references(() => seo.seoId),
    priority: int('priority').notNull().default(0),
    isAvailableOnWeb: boolean('is_available_on_web').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    uniqueIndex('product_categories_slug_uq').on(table.slug),
    uniqueIndex('product_categories_name_parent_uq').on(table.name, table.parentId),
    index('product_categories_parent_id_idx').on(table.parentId),
    index('product_categories_seo_id_idx').on(table.seoId),
    index('product_categories_is_active_idx').on(table.isActive),
  ],
);
