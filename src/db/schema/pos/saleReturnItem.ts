import { decimal, index, int, mysqlEnum, mysqlTable } from 'drizzle-orm/mysql-core';
import { stockStatuses } from '../stock/stockStatus';
import { stock } from '../stock/stock';
import { saleItems } from './saleItem';
import { saleReturns } from './saleReturn';

export const saleReturnItems = mysqlTable(
  'sale_return_items',
  {
    id: int('id').primaryKey().autoincrement(),
    saleReturnId: int('sale_return_id')
      .notNull()
      .references(() => saleReturns.id),
    saleItemId: int('sale_item_id')
      .notNull()
      .references(() => saleItems.id),
    stockId: int('stock_id').references(() => stock.id),
    quantity: int('quantity').notNull().default(1),
    refundAmount: decimal('refund_amount', { precision: 12, scale: 2 }).notNull(),
    condition: mysqlEnum('condition', ['sealed', 'opened', 'damaged', 'defective']).notNull(),
    restockStatus: int('restock_status').references(() => stockStatuses.id),
  },
  (table) => [
    index('sale_return_items_sale_return_id_idx').on(table.saleReturnId),
    index('sale_return_items_condition_idx').on(table.condition),
  ],
);
