import { boolean, double, index, int, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
export const permissions = mysqlTable(
  'permissions',
  {
    id: int('id').primaryKey().autoincrement(),
    key: varchar('key', { length: 150 }).notNull(),
    module: varchar('module', { length: 80 }).notNull(),
    priority: double('priority').notNull().default(100),
    mainCategory: varchar('main_category', { length: 100 }).notNull().default('General'),
    category: varchar('category', { length: 100 }).notNull().default('General'),
    title: varchar('title', { length: 150 }).notNull().default('Permission'),
    description: varchar('description', { length: 255 }),
    isSystem: boolean('is_system').notNull().default(false),
  },
  (table) => [uniqueIndex('permissions_key_uq').on(table.key), index('permissions_module_idx').on(table.module)],
);
