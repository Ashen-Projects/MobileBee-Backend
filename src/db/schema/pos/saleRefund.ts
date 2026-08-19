import { bigint, decimal, index, int, mysqlEnum, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
import { users } from '../user/user';
import { saleReturns } from './saleReturn';

export const saleRefunds = mysqlTable(
  'sale_refunds',
  {
    id: int('id').primaryKey().autoincrement(),
    saleReturnId: int('sale_return_id')
      .notNull()
      .references(() => saleReturns.id),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    method: mysqlEnum('method', ['cash', 'cardReversal', 'bankTransfer', 'creditNote']).notNull(),
    referenceNo: varchar('reference_no', { length: 255 }),
    processedBy: int('processed_by')
      .notNull()
      .references(() => users.id),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    index('sale_refunds_sale_return_id_idx').on(table.saleReturnId),
    index('sale_refunds_method_idx').on(table.method),
    index('sale_refunds_timestamp_idx').on(table.timestamp),
  ],
);
