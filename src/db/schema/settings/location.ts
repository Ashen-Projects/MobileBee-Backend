import { bigint, boolean, index, int, mysqlEnum, mysqlTable, text, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
export const locations = mysqlTable(
  'locations',
  {
    id: int('id').primaryKey().autoincrement(),
    code: varchar('code', { length: 50 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    type: mysqlEnum('type', ['shop', 'warehouse', 'repairCentre']).notNull().default('shop'),
    phone: varchar('phone', { length: 30 }),
    address: text('address'),
    isActive: boolean('is_active').notNull().default(true),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    uniqueIndex('locations_code_uq').on(table.code),
    index('locations_name_idx').on(table.name),
    index('locations_type_idx').on(table.type),
    index('locations_is_active_idx').on(table.isActive),
  ],
);
