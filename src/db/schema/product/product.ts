import { boolean, decimal, index, int, mysqlTable, text, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { productCategories } from './productCategory';
import { seo } from './seo';

export const products = mysqlTable(
  'products',
  {
    id: int('id').primaryKey().autoincrement(),
    name: varchar('name', { length: 255 }).notNull(),
    sku: varchar('sku', { length: 100 }),
    shortDescription: varchar('short_description', { length: 1024 }),
    description: text('description'),
    lowestSellingPrice: decimal('lowest_selling_price', { precision: 10, scale: 2 }).notNull(),
    mrpPrice: decimal('mrp_price', { precision: 10, scale: 2 }).notNull(),
    maxPurchasingPrice: decimal('max_purchasing_price', { precision: 10, scale: 2 }).notNull(),
    parentId: int('parent_id'),
    categoryId: int('category_id').references(() => productCategories.id),
    priority: int('priority'),
    iconUrl: varchar('icon_url', { length: 1024 }),
    logoUrl: varchar('logo_url', { length: 1024 }),
    seoId: int('seo_id').references(() => seo.seoId),
    isAvailableOnWeb: boolean('is_available_on_web').notNull().default(false),
    hasVariations: boolean('has_variations').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    uniqueIndex('products_name_uq').on(table.name),
    uniqueIndex('products_sku_uq').on(table.sku),
    index('products_parent_id_idx').on(table.parentId),
    index('products_category_id_idx').on(table.categoryId),
    index('products_seo_id_idx').on(table.seoId),
    index('products_is_active_idx').on(table.isActive),
  ],
);
