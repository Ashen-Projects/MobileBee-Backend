import { bigint, boolean, index, int, mysqlTable, text, varchar } from 'drizzle-orm/mysql-core';
export const customers = mysqlTable(
  'customers',
  {
    id: int('id').primaryKey().autoincrement(),
    name: varchar('name', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 30 }),
    email: varchar('email', { length: 255 }),
    nic: varchar('nic', { length: 50 }),
    address: text('address'),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [index('customers_name_idx').on(table.name), index('customers_phone_idx').on(table.phone), index('customers_nic_idx').on(table.nic)],
);
