import { int, mysqlTable, primaryKey } from 'drizzle-orm/mysql-core';
import { permissions } from './permission';
import { roles } from './role';

export const rolePermissions = mysqlTable(
  'role_permissions',
  {
    roleId: int('role_id')
      .notNull()
      .references(() => roles.id),
    permissionId: int('permission_id')
      .notNull()
      .references(() => permissions.id),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
);
