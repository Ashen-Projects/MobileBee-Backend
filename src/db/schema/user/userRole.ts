import { bigint, int, mysqlTable, primaryKey } from 'drizzle-orm/mysql-core';
import { locations } from '../settings/location';
import { roles } from './role';
import { users } from './user';

export const userRoles = mysqlTable(
  'user_roles',
  {
    userId: int('user_id')
      .notNull()
      .references(() => users.id),
    roleId: int('role_id')
      .notNull()
      .references(() => roles.id),
    locationId: int('location_id').references(() => locations.id),
    assignedBy: int('assigned_by')
      .notNull()
      .references(() => users.id),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
);
