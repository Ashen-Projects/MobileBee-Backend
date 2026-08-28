import { bigint, index, int, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
import { users } from '../../user/user';
import { grns } from './grn';

export const grnDocuments = mysqlTable(
  'grn_documents',
  {
    id: int('id').primaryKey().autoincrement(),
    grnId: int('grn_id')
      .notNull()
      .references(() => grns.id),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileUrl: varchar('file_url', { length: 1024 }).notNull(),
    documentType: varchar('document_type', { length: 80 }).notNull(),
    uploadedBy: int('uploaded_by')
      .notNull()
      .references(() => users.id),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [index('grn_documents_grn_id_idx').on(table.grnId), index('grn_documents_document_type_idx').on(table.documentType)],
);
