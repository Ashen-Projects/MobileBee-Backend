import { index, int, mysqlTable, uniqueIndex } from 'drizzle-orm/mysql-core';

import { grnCountSessions } from './grnCountSession';
import { grnItems } from './grnItem';

export const grnCountItemEntries = mysqlTable(
  'grn_count_item_entries',
  {
    id: int('id').primaryKey().autoincrement(),
    countSessionId: int('count_session_id').notNull().references(() => grnCountSessions.id, { onDelete: 'cascade' }),
    grnItemId: int('grn_item_id').notNull().references(() => grnItems.id),
    countedQuantity: int('counted_quantity').notNull(),
  },
  (table) => [
    uniqueIndex('grn_count_item_entries_session_item_uq').on(table.countSessionId, table.grnItemId),
    index('grn_count_item_entries_grn_item_idx').on(table.grnItemId),
  ],
);
