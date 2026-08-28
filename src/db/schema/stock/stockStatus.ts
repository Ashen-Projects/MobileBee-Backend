import { boolean, index, int, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
export const stockStatuses = mysqlTable(
  'stock_statuses',
  {
    id: int('id').primaryKey().autoincrement(),
    name: varchar('name', { length: 100 }).notNull(),
    label: varchar('label', { length: 150 }).notNull(),
    isSellable: boolean('is_sellable').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    uniqueIndex('stock_statuses_name_uq').on(table.name),
    index('stock_statuses_is_sellable_idx').on(table.isSellable),
  ],
);
