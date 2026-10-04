import { bigint, decimal, index, int, mysqlEnum, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { products } from '../product/product';
import { stock } from '../stock/stock';
import { repairJobs } from './repairJob';

export const repairParts = mysqlTable(
  'repair_parts',
  {
    id: int('id').primaryKey().autoincrement(),
    repairJobId: int('repair_job_id')
      .notNull()
      .references(() => repairJobs.id),
    stockId: int('stock_id').references(() => stock.id),
    productId: int('product_id').references(() => products.id),
    description: varchar('description', { length: 255 }).notNull(),
    quantity: int('quantity').notNull().default(1),
    unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull().default('0.00'),
    // This is an internal inventory lifecycle. It is never exposed on the
    // customer receipt, which always shows one final repair total.
    status: mysqlEnum('status', ['reserved', 'consumed', 'released']).notNull().default('reserved'),
    consumedAt: bigint('consumed_at', { mode: 'number', unsigned: true }),
    releasedAt: bigint('released_at', { mode: 'number', unsigned: true }),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    uniqueIndex('repair_parts_repair_stock_uq').on(table.repairJobId, table.stockId),
    index('repair_parts_repair_job_id_idx').on(table.repairJobId),
    index('repair_parts_repair_status_idx').on(table.repairJobId, table.status),
  ],
);
