import { bigint, decimal, index, int, mysqlEnum, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { suppliers } from './supplier/supplier';
import { grns } from './grn/grn';

export const supplierInvoices = mysqlTable(
  'supplier_invoices',
  {
    id: int('id').primaryKey().autoincrement(),
    invoiceNo: varchar('invoice_no', { length: 100 }).notNull(),
    supplierId: int('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    grnId: int('grn_id')
      .notNull()
      .references(() => grns.id),
    invoiceDate: bigint('invoice_date', { mode: 'number', unsigned: true }).notNull(),
    dueDate: bigint('due_date', { mode: 'number', unsigned: true }),
    subTotal: decimal('sub_total', { precision: 12, scale: 2 }).notNull(),
    taxAmount: decimal('tax_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
    discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
    totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
    paidAmount: decimal('paid_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
    status: mysqlEnum('status', ['unpaid', 'partiallyPaid', 'paid', 'cancelled']).notNull().default('unpaid'),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    uniqueIndex('supplier_invoices_invoice_supplier_uq').on(table.invoiceNo, table.supplierId),
    index('supplier_invoices_grn_id_idx').on(table.grnId),
    index('supplier_invoices_invoice_date_idx').on(table.invoiceDate),
    index('supplier_invoices_due_date_idx').on(table.dueDate),
    index('supplier_invoices_status_idx').on(table.status),
  ],
);
