import { int, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
export const seo = mysqlTable('seo', {
  seoId: int('seo_id').primaryKey().autoincrement(),
  metaTitle: varchar('meta_title', { length: 255 }),
  metaDescription: varchar('meta_description', { length: 512 }),
  keywords: varchar('keywords', { length: 512 }),
  canonicalUrl: varchar('canonical_url', { length: 1024 }),
  ogImageUrl: varchar('og_image_url', { length: 1024 }),
});
