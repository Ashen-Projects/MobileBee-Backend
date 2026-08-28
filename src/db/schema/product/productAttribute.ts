import { boolean, int, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
export const productAttributes = mysqlTable('product_attributes', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  displayName: varchar('display_name', { length: 150 }).notNull(),
  description: varchar('description', { length: 1024 }),
  preUnit: varchar('pre_unit', { length: 50 }),
  postUnit: varchar('post_unit', { length: 50 }),
  isEffectOnImages: boolean('is_effect_on_images').notNull().default(false),
  isEffectOnPricing: boolean('is_effect_on_pricing').notNull().default(false),
  isEffectOnDescription: boolean('is_effect_on_description').notNull().default(false),
  priority: int('priority').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
});
