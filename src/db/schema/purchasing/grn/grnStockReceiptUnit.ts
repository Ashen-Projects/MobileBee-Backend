import { foreignKey, int, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';

import { stock } from '../../stock/stock';
import { grnStockReceiptItems } from './grnStockReceiptItem';

/** Physical stock-unit snapshots, including the barcode printed for that unit. */
export const grnStockReceiptUnits = mysqlTable(
  'grn_stock_receipt_units',
  {
    id: int('id').primaryKey().autoincrement(),
    stockReceiptItemId: int('stock_receipt_item_id').notNull(),
    stockId: int('stock_id').notNull(),
    barcode: varchar('barcode', { length: 64 }),
  },
  (table) => [
    foreignKey({ columns: [table.stockReceiptItemId], foreignColumns: [grnStockReceiptItems.id], name: 'gsru_receipt_item_fk' }).onDelete('cascade'),
    foreignKey({ columns: [table.stockId], foreignColumns: [stock.id], name: 'gsru_stock_fk' }),
    uniqueIndex('grn_stock_receipt_units_stock_id_uq').on(table.stockId),
  ],
);
