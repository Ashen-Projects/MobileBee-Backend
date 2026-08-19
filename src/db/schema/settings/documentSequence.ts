import { bigint, int, mysqlTable, unique, varchar } from 'drizzle-orm/mysql-core';
import { locations } from './location';

export const documentSequences = mysqlTable(
  'document_sequences',
  {
    id: int('id').primaryKey().autoincrement(),
    documentType: varchar('document_type', { length: 50 }).notNull(),
    locationId: int('location_id').references(() => locations.id),
    year: int('year').notNull(),
    lastNumber: bigint('last_number', { mode: 'number', unsigned: true }).notNull().default(0),
    prefix: varchar('prefix', { length: 30 }).notNull(),
  },
  (table) => [unique('document_sequences_type_location_year_uq').on(table.documentType, table.locationId, table.year)],
);
