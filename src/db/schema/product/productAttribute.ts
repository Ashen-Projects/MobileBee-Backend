import { boolean, int, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
export const productAttributes = mysqlTable('product_attributes', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  displayName: varchar('display_name', { length: 150 }).notNull(),
  priority: int('priority').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
});
