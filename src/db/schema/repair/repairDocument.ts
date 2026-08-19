import { bigint, index, int, mysqlEnum, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
import { users } from '../user/user';
import { repairJobs } from './repairJob';

export const repairDocuments = mysqlTable(
  'repair_documents',
  {
    id: int('id').primaryKey().autoincrement(),
    repairJobId: int('repair_job_id')
      .notNull()
      .references(() => repairJobs.id),
    documentType: mysqlEnum('document_type', [
      'intakePhoto',
      'estimate',
      'approval',
      'repairPhoto',
      'deliveryProof',
      'other',
    ]).notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileUrl: varchar('file_url', { length: 1024 }).notNull(),
    uploadedBy: int('uploaded_by')
      .notNull()
      .references(() => users.id),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    index('repair_documents_repair_job_id_idx').on(table.repairJobId),
    index('repair_documents_document_type_idx').on(table.documentType),
  ],
);
