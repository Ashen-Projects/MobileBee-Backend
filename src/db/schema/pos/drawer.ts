import { bigint, decimal, index, int, mysqlEnum, mysqlTable, text } from 'drizzle-orm/mysql-core';

import { locations } from '../settings/location';
import { users } from '../user/user';

export const posDrawers = mysqlTable(
  'pos_drawers',
  {
    id: int('id').primaryKey().autoincrement(),
    locationId: int('location_id')
      .notNull()
      .references(() => locations.id),
    userId: int('user_id')
      .notNull()
      .references(() => users.id),
    status: mysqlEnum('status', ['open', 'closed']).notNull().default('open'),
    openingCash: decimal('opening_cash', { precision: 12, scale: 2 }).notNull().default('0.00'),
    countedCash: decimal('counted_cash', { precision: 12, scale: 2 }),
    countedCardTotal: decimal('counted_card_total', { precision: 12, scale: 2 }),
    countedBankTransferTotal: decimal('counted_bank_transfer_total', { precision: 12, scale: 2 }),
    cashExpenseAmount: decimal('cash_expense_amount', { precision: 12, scale: 2 }),
    openNote: text('open_note'),
    closeNote: text('close_note'),
    openedAt: bigint('opened_at', { mode: 'number', unsigned: true }).notNull(),
    closedAt: bigint('closed_at', { mode: 'number', unsigned: true }),
    openedBy: int('opened_by')
      .notNull()
      .references(() => users.id),
    closedBy: int('closed_by').references(() => users.id),
  },
  (table) => [
    index('pos_drawers_user_status_idx').on(table.userId, table.status),
    index('pos_drawers_location_status_idx').on(table.locationId, table.status),
    index('pos_drawers_opened_at_idx').on(table.openedAt),
  ],
);
