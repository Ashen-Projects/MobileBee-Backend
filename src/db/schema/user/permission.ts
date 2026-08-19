import { index, int, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
export const permissions = mysqlTable(
  'permissions',
  {
    id: int('id').primaryKey().autoincrement(),
    key: varchar('key', { length: 150 }).notNull(),
    module: varchar('module', { length: 80 }).notNull(),
    description: varchar('description', { length: 255 }),
  },
  (table) => [uniqueIndex('permissions_key_uq').on(table.key), index('permissions_module_idx').on(table.module)],
);
