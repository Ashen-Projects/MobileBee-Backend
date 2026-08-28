import { decimal, foreignKey, index, int, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { locations } from '../settings/location';
import { stockAdjustments } from './stockAdjustment';
import { stockStatuses } from './stockStatus';
import { stock } from './stock';

export const stockAdjustmentItems = mysqlTable(
  'stock_adjustment_items',
  {
    id: int('id').primaryKey().autoincrement(),
    stockAdjustmentId: int('stock_adjustment_id').notNull(),
    stockId: int('stock_id')
      .notNull()
      .references(() => stock.id),
    oldStatus: int('old_status').references(() => stockStatuses.id),
    newStatus: int('new_status').references(() => stockStatuses.id),
    oldLocationId: int('old_location_id').references(() => locations.id),
    newLocationId: int('new_location_id').references(() => locations.id),
    oldCostPrice: decimal('old_cost_price', { precision: 10, scale: 2 }),
    newCostPrice: decimal('new_cost_price', { precision: 10, scale: 2 }),
    note: varchar('note', { length: 512 }),
  },
  (table) => [
    foreignKey({
      columns: [table.stockAdjustmentId],
      foreignColumns: [stockAdjustments.id],
      name: 'stock_adj_items_adjustment_fk',
    }),
    uniqueIndex('stock_adjustment_items_adjustment_stock_uq').on(table.stockAdjustmentId, table.stockId),
    index('stock_adjustment_items_stock_id_idx').on(table.stockId),
  ],
);
