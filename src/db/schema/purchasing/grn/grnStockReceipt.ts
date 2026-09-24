import { bigint, index, int, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';

import { locations } from '../../settings/location';
import { suppliers } from '../supplier/supplier';
import { users } from '../../user/user';
import { grns } from './grn';

/**
 * Immutable document header created for every successful Add to Stock action.
 * Snapshot fields ensure an old receiving note remains accurate even if a
 * supplier or location is renamed later.
 */
export const grnStockReceipts = mysqlTable(
  'grn_stock_receipts',
  {
    id: int('id').primaryKey().autoincrement(),
    grnId: int('grn_id').notNull().references(() => grns.id),
    supplierId: int('supplier_id').notNull().references(() => suppliers.id),
    locationId: int('location_id').notNull().references(() => locations.id),
    createdBy: int('created_by').notNull().references(() => users.id),
    noteNumber: varchar('note_number', { length: 100 }).notNull(),
    supplierCode: varchar('supplier_code', { length: 100 }).notNull(),
    supplierName: varchar('supplier_name', { length: 255 }).notNull(),
    locationName: varchar('location_name', { length: 255 }).notNull(),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    uniqueIndex('grn_stock_receipts_note_number_uq').on(table.noteNumber),
    index('grn_stock_receipts_location_timestamp_idx').on(table.locationId, table.timestamp),
  ],
);
