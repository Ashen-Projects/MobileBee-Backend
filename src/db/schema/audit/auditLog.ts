import { bigint, index, int, json, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
import { users } from '../user/user';

export const auditLogs = mysqlTable(
  'audit_logs',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
    userId: int('user_id').references(() => users.id),
    module: varchar('module', { length: 100 }).notNull(),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 100 }).notNull(),
    entityId: int('entity_id'),
    oldValues: json('old_values'),
    newValues: json('new_values'),
    ipAddress: varchar('ip_address', { length: 45 }),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    index('audit_logs_user_id_idx').on(table.userId),
    index('audit_logs_module_idx').on(table.module),
    index('audit_logs_action_idx').on(table.action),
    index('audit_logs_entity_type_idx').on(table.entityType),
    index('audit_logs_entity_id_idx').on(table.entityId),
    index('audit_logs_timestamp_idx').on(table.timestamp),
  ],
);
