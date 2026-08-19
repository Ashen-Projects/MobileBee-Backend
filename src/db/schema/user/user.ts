import { bigint, boolean, index, int, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { locations } from '../settings/location';

export const users = mysqlTable(
  'users',
  {
    id: int('id').primaryKey().autoincrement(),
    firebaseUid: varchar('firebase_uid', { length: 128 }).notNull(),
    username: varchar('username', { length: 100 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 30 }),
    defaultLocationId: int('default_location_id').references(() => locations.id),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: bigint('last_login_at', { mode: 'number', unsigned: true }),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [
    uniqueIndex('users_username_uq').on(table.username),
    uniqueIndex('users_firebase_uid_uq').on(table.firebaseUid),
    uniqueIndex('users_email_uq').on(table.email),
    index('users_default_location_id_idx').on(table.defaultLocationId),
    index('users_is_active_idx').on(table.isActive),
  ],
);
