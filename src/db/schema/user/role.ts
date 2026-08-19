import { boolean, int, mysqlTable, text, varchar } from 'drizzle-orm/mysql-core';
export const roles = mysqlTable('roles', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  label: varchar('label', { length: 150 }).notNull(),
  description: text('description'),
  isSystem: boolean('is_system').notNull().default(false),
});
