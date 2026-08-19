import { bigint, decimal, index, int, mysqlEnum, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
import { users } from '../user/user';
import { sales } from './sale';

export const salePayments = mysqlTable(
  'sale_payments',
  {
    id: int('id').primaryKey().autoincrement(),
    saleId: int('sale_id')
      .notNull()
      .references(() => sales.id),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    method: mysqlEnum('method', ['cash', 'card', 'bankTransfer', 'finance', 'mobile']).notNull(),
    referenceNo: varchar('reference_no', { length: 255 }),
    receivedBy: int('received_by')
      .notNull()
      .references(() => users.id),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    index('sale_payments_sale_id_idx').on(table.saleId),
    index('sale_payments_method_idx').on(table.method),
    index('sale_payments_reference_no_idx').on(table.referenceNo),
    index('sale_payments_timestamp_idx').on(table.timestamp),
  ],
);
