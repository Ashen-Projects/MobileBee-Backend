import { bigint, decimal, index, int, mysqlEnum, mysqlTable, text, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { users } from '../user/user';
import { suppliers } from './supplier/supplier';
import { grns } from './grn/grn';
import { supplierInvoices } from './supplierInvoice';

export const supplierPayments = mysqlTable(
  'supplier_payments',
  {
    id: int('id').primaryKey().autoincrement(),
    paymentNo: varchar('payment_no', { length: 100 }).notNull(),
    supplierId: int('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    supplierInvoiceId: int('supplier_invoice_id').references(() => supplierInvoices.id),
    grnId: int('grn_id').references(() => grns.id),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    method: mysqlEnum('method', ['cash', 'bankTransfer', 'cheque', 'card']).notNull(),
    referenceNo: varchar('reference_no', { length: 255 }),
    paidBy: int('paid_by')
      .notNull()
      .references(() => users.id),
    paymentDate: bigint('payment_date', { mode: 'number', unsigned: true }).notNull(),
    note: text('note'),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    uniqueIndex('supplier_payments_payment_no_uq').on(table.paymentNo),
    index('supplier_payments_supplier_id_idx').on(table.supplierId),
    index('supplier_payments_method_idx').on(table.method),
    index('supplier_payments_reference_no_idx').on(table.referenceNo),
    index('supplier_payments_payment_date_idx').on(table.paymentDate),
  ],
);
