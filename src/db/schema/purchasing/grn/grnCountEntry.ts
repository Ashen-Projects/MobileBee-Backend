import { index, int, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';

import { stock } from '../../stock/stock';
import { grnCountSessions } from './grnCountSession';

export const grnCountEntries = mysqlTable(
  'grn_count_entries',
  {
    id: int('id').primaryKey().autoincrement(),
    countSessionId: int('count_session_id').notNull().references(() => grnCountSessions.id, { onDelete: 'cascade' }),
    stockId: int('stock_id').notNull().references(() => stock.id),
    scannedCode: varchar('scanned_code', { length: 64 }).notNull(),
  },
  (table) => [
    uniqueIndex('grn_count_entries_session_stock_uq').on(table.countSessionId, table.stockId),
    index('grn_count_entries_stock_id_idx').on(table.stockId),
  ],
);
