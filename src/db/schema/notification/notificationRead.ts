import { bigint, int, mysqlTable, primaryKey } from 'drizzle-orm/mysql-core';

import { users } from '../user';
import { notifications } from './notification';

export const notificationReads = mysqlTable(
  'notification_reads',
  {
    notificationId: int('notification_id')
      .notNull()
      .references(() => notifications.id),
    readAt: bigint('read_at', { mode: 'number', unsigned: true }).notNull(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id),
  },
  (table) => [primaryKey({ columns: [table.notificationId, table.userId] })],
);
