import { bigint, int, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { stockTransfers } from './stockTransfer';
import { stock } from './stock';

export const stockTransferItems = mysqlTable(
  'stock_transfer_items',
  {
    id: int('id').primaryKey().autoincrement(),
    stockTransferId: int('stock_transfer_id')
      .notNull()
      .references(() => stockTransfers.id),
    stockId: int('stock_id')
      .notNull()
      .references(() => stock.id),
    conditionOut: varchar('condition_out', { length: 255 }),
    conditionIn: varchar('condition_in', { length: 255 }),
    receivedAt: bigint('received_at', { mode: 'number', unsigned: true }),
  },
  (table) => [uniqueIndex('stock_transfer_items_transfer_stock_uq').on(table.stockTransferId, table.stockId)],
);
