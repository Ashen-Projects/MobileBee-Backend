import { bigint, index, int, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { users } from './user';

export const userSessions = mysqlTable(
  'user_sessions',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: varchar('user_agent', { length: 512 }),
    expiresAt: bigint('expires_at', { mode: 'number', unsigned: true }).notNull(),
    revokedAt: bigint('revoked_at', { mode: 'number', unsigned: true }),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    index('user_sessions_user_id_idx').on(table.userId),
    uniqueIndex('user_sessions_token_hash_uq').on(table.tokenHash),
    index('user_sessions_expires_at_idx').on(table.expiresAt),
  ],
);
