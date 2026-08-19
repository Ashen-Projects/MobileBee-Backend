import { boolean, int, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
export const purchaseOrderStatuses = mysqlTable('purchase_order_statuses', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  label: varchar('label', { length: 150 }).notNull(),
  isFinal: boolean('is_final').notNull().default(false),
  priority: int('priority').notNull().default(0),
});
