import { bigint, index, int, mysqlTable, text, varchar } from 'drizzle-orm/mysql-core';

import { locations } from '../settings';
import { users } from '../user';

export const notifications = mysqlTable(
  'notifications',
  {
    id: int('id').primaryKey().autoincrement(),
    title: varchar('title', { length: 180 }).notNull(),
    message: text('message').notNull(),
    module: varchar('module', { length: 80 }).notNull().default('general'),
    severity: varchar('severity', { length: 30 }).notNull().default('info'),
    entityType: varchar('entity_type', { length: 80 }),
    entityId: int('entity_id'),
    locationId: int('location_id').references(() => locations.id),
    targetPermission: varchar('target_permission', { length: 150 }),
    targetUserId: int('target_user_id').references(() => users.id),
    createdBy: int('created_by').references(() => users.id),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
    expiresAt: bigint('expires_at', { mode: 'number', unsigned: true }),
  },
  (table) => [
    index('notifications_module_idx').on(table.module),
    index('notifications_location_idx').on(table.locationId),
    index('notifications_target_user_idx').on(table.targetUserId),
    index('notifications_timestamp_idx').on(table.timestamp),
  ],
);
