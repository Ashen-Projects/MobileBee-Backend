import { bigint, int, mysqlTable, primaryKey, uniqueIndex } from 'drizzle-orm/mysql-core';
import { stock } from '../stock/stock';
import { saleItems } from './saleItem';

export const saleItemStock = mysqlTable(
  'sale_item_stock',
  {
    saleItemId: int('sale_item_id')
      .notNull()
      .references(() => saleItems.id),
    stockId: int('stock_id')
      .notNull()
      .references(() => stock.id),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.saleItemId, table.stockId] }), uniqueIndex('sale_item_stock_stock_id_uq').on(table.stockId)],
);
