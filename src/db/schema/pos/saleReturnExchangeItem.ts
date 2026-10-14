import { decimal, index, int, mysqlTable, uniqueIndex } from 'drizzle-orm/mysql-core';
import { products } from '../product/product';
import { stock } from '../stock/stock';
import { saleReturns } from './saleReturn';

/** Immutable replacement-unit snapshot for an item-only customer exchange. */
export const saleReturnExchangeItems = mysqlTable(
  'sale_return_exchange_items',
  {
    id: int('id').primaryKey().autoincrement(),
    saleReturnId: int('sale_return_id').notNull().references(() => saleReturns.id),
    stockId: int('stock_id').notNull().references(() => stock.id),
    productId: int('product_id').notNull().references(() => products.id),
    unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
    totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  },
  (table) => [
    index('sale_ret_exch_item_return_idx').on(table.saleReturnId),
    uniqueIndex('sale_ret_exch_item_stock_uq').on(table.stockId),
  ],
);
