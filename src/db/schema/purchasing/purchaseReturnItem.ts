import { decimal, index, int, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { stock } from '../stock/stock';
import { purchaseReturns } from './purchaseReturn';

export const purchaseReturnItems = mysqlTable(
  'purchase_return_items',
  {
    id: int('id').primaryKey().autoincrement(),
    purchaseReturnId: int('purchase_return_id')
      .notNull()
      .references(() => purchaseReturns.id),
    stockId: int('stock_id')
      .notNull()
      .references(() => stock.id),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    conditionNote: varchar('condition_note', { length: 512 }),
  },
  (table) => [
    uniqueIndex('purchase_return_items_stock_id_uq').on(table.stockId),
    index('purchase_return_items_purchase_return_id_idx').on(table.purchaseReturnId),
  ],
);
