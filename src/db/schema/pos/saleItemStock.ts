import { bigint, index, int, mysqlTable, primaryKey } from 'drizzle-orm/mysql-core';
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
  // A stock unit can be sold again after a valid customer return restores it to stock.
  // The composite key still prevents the same unit being attached twice to one sale item.
  (table) => [
    primaryKey({ columns: [table.saleItemId, table.stockId] }),
    // The FK needs an index, but it must not be unique across sale history.
    index('sale_item_stock_stock_id_idx').on(table.stockId),
  ],
);
