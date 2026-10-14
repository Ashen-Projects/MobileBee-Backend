import { bigint, decimal, index, int, mysqlEnum, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
import { users } from '../user/user';
import { saleReturns } from './saleReturn';

/** Additional collection only. Returns never create a customer cash payout. */
export const saleReturnPayments = mysqlTable(
  'sale_return_payments',
  {
    id: int('id').primaryKey().autoincrement(),
    saleReturnId: int('sale_return_id').notNull().references(() => saleReturns.id),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    method: mysqlEnum('method', ['cash', 'card', 'bankTransfer', 'mobile']).notNull(),
    referenceNo: varchar('reference_no', { length: 255 }),
    receivedBy: int('received_by').notNull().references(() => users.id),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    index('sale_ret_pay_return_idx').on(table.saleReturnId),
    index('sale_ret_pay_method_idx').on(table.method),
  ],
);
