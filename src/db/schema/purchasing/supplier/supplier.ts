import { boolean, decimal, index, int, mysqlTable, text, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
export const suppliers = mysqlTable(
  'suppliers',
  {
    id: int('id').primaryKey().autoincrement(),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 50 }).notNull(),
    contactPerson: varchar('contact_person', { length: 255 }),
    phone: varchar('phone', { length: 30 }),
    email: varchar('email', { length: 255 }),
    address: text('address'),
    creditLimit: decimal('credit_limit', { precision: 12, scale: 2 }).default('0.00'),
    paymentTermDays: int('payment_term_days').default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    uniqueIndex('suppliers_name_uq').on(table.name),
    uniqueIndex('suppliers_code_uq').on(table.code),
    index('suppliers_phone_idx').on(table.phone),
    index('suppliers_is_active_idx').on(table.isActive),
  ],
);
