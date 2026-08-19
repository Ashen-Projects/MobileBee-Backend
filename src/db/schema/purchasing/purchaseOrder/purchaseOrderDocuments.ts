import { bigint, index, int, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
import { users } from '../../user/user';
import { purchaseOrders } from './purchaseOrder';

export const purchaseOrderDocuments = mysqlTable(
  'purchase_order_documents',
  {
    id: int('id').primaryKey().autoincrement(),
    purchaseOrderId: int('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileUrl: varchar('file_url', { length: 1024 }).notNull(),
    documentType: varchar('document_type', { length: 80 }),
    uploadedBy: int('uploaded_by')
      .notNull()
      .references(() => users.id),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    index('purchase_order_documents_purchase_order_id_idx').on(table.purchaseOrderId),
    index('purchase_order_documents_document_type_idx').on(table.documentType),
  ],
);
