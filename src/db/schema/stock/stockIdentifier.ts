import { boolean, index, int, mysqlEnum, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { stock } from './stock';

export const stockIdentifiers = mysqlTable(
  'stock_identifiers',
  {
    id: int('id').primaryKey().autoincrement(),
    stockId: int('stock_id')
      .notNull()
      .references(() => stock.id, { onDelete: 'cascade' }),
    type: mysqlEnum('type', ['imei', 'serial']).notNull(),
    value: varchar('value', { length: 64 }).notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
  },
  (table) => [
    uniqueIndex('stock_identifiers_value_uq').on(table.value),
    index('stock_identifiers_stock_id_idx').on(table.stockId),
    index('stock_identifiers_stock_type_idx').on(table.stockId, table.type),
  ],
);
