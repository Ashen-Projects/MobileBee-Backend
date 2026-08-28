import { asc, eq, inArray } from 'drizzle-orm';

import { db } from '../../db';
import { auditLogs, locations, permissions, rolePermissions, roles, userRoles, users } from '../../db/schema';
import { AppError } from '../../errors/app-error';
import { USER_ACCESS, USER_ROLES } from '../../utils/constants';
import type { AuthenticatedUser } from '../auth/authService';
import {
  createRoleSchema,
  createPermissionSchema,
  replaceRolePermissionsSchema,
  roleIdSchema,
  updateRoleSchema,
  updatePermissionSchema,
  userRoleAssignmentsSchema,
} from './roleValidation';

type AuditContext = { ipAddress?: string };

const normalizeRoleName = (label: string): string => label
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const findRole = async (id: number) => {
  const [role] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  if (!role) throw new AppError('Role not found.', 404);
  return role;
};

const assertPermissionIdsExist = async (permissionIds: number[]) => {
  if (!permissionIds.length) return;
  const rows = await db.select({ id: permissions.id }).from(permissions).where(inArray(permissions.id, permissionIds));
  if (rows.length !== permissionIds.length) throw new AppError('One or more permissions do not exist.', 400);
};

const getPermissionRows = async (roleId: number) => db
  .select({ description: permissions.description, id: permissions.id, key: permissions.key, module: permissions.module })
  .from(rolePermissions)
  .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
  .where(eq(rolePermissions.roleId, roleId))
  .orderBy(asc(permissions.module), asc(permissions.key));

export const listPermissions = async () => db.select().from(permissions)
  .orderBy(asc(permissions.module), asc(permissions.key));

export const listAssignableLocations = async () => db
  .select({ id: locations.id, name: locations.name })
  .from(locations)
  .where(eq(locations.isActive, true))
  .orderBy(asc(locations.name));

export const createPermission = async (
  input: unknown,
  administrator: AuthenticatedUser,
  context: AuditContext = {},
) => {
  const data = createPermissionSchema.parse(input);
  const module = data.module ?? data.key.split('.')[0];
  const defaultTitle = data.key.split('.').map((part) => part.replace(/_/g, ' '))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' — ');
  const [duplicate] = await db.select({ id: permissions.id }).from(permissions)
    .where(eq(permissions.key, data.key)).limit(1);
  if (duplicate) throw new AppError('This permission already exists.', 409);

  const id = await db.transaction(async (transaction) => {
    const [adminRole] = await transaction.select({ id: roles.id }).from(roles)
      .where(eq(roles.name, USER_ROLES.ADMIN)).limit(1);
    if (!adminRole) throw new AppError('Administrator role is not initialized.', 500);

    const result = await transaction.insert(permissions).values({
      category: data.category ?? module,
      description: data.description ?? null,
      isSystem: false,
      key: data.key,
      mainCategory: data.mainCategory ?? module,
      module,
      priority: data.priority ?? 100,
      title: data.title ?? defaultTitle,
    });
    const permissionId = Number(result[0].insertId);
    await transaction.insert(rolePermissions).values({
      permissionId,
      roleId: adminRole.id,
    });
    await transaction.insert(auditLogs).values({
      action: 'create', entityId: permissionId, entityType: 'permission', ipAddress: context.ipAddress,
      module: 'permissions', newValues: {
        ...data,
        assignedToAdministrator: true,
        key: data.key,
        module,
        title: data.title ?? defaultTitle,
      },
      timestamp: Date.now(), userId: administrator.id,
    });
    return permissionId;
  });
  const [created] = await db.select().from(permissions).where(eq(permissions.id, id)).limit(1);
  return created;
};

export const updatePermission = async (
  idInput: unknown,
  input: unknown,
  administrator: AuthenticatedUser,
  context: AuditContext = {},
) => {
  const id = roleIdSchema.parse(idInput);
  const data = updatePermissionSchema.parse(input);
  const [current] = await db.select().from(permissions).where(eq(permissions.id, id)).limit(1);
  if (!current) throw new AppError('Permission not found.', 404);
  if (current.isSystem) throw new AppError('System permissions cannot be edited.', 400);
  if (data.key && data.key !== current.key) {
    const [duplicate] = await db.select({ id: permissions.id }).from(permissions)
      .where(eq(permissions.key, data.key)).limit(1);
    if (duplicate) throw new AppError('This permission already exists.', 409);
  }
  const next = {
    category: data.category ?? current.category,
    description: data.description === undefined ? current.description : data.description,
    key: data.key ?? current.key,
    mainCategory: data.mainCategory ?? current.mainCategory,
    module: data.module ?? current.module,
    priority: data.priority ?? current.priority,
    title: data.title ?? current.title,
  };
  await db.transaction(async (transaction) => {
    await transaction.update(permissions).set(next).where(eq(permissions.id, id));
    await transaction.insert(auditLogs).values({
      action: 'update', entityId: id, entityType: 'permission', ipAddress: context.ipAddress,
      module: 'permissions', newValues: next, oldValues: current, timestamp: Date.now(), userId: administrator.id,
    });
  });
  return { ...current, ...next };
};

export const deletePermission = async (
  idInput: unknown,
  administrator: AuthenticatedUser,
  context: AuditContext = {},
) => {
  const id = roleIdSchema.parse(idInput);
  const [current] = await db.select().from(permissions).where(eq(permissions.id, id)).limit(1);
  if (!current) throw new AppError('Permission not found.', 404);
  if (current.isSystem) throw new AppError('System permissions cannot be deleted.', 400);
  await db.transaction(async (transaction) => {
    await transaction.delete(rolePermissions).where(eq(rolePermissions.permissionId, id));
    await transaction.delete(permissions).where(eq(permissions.id, id));
    await transaction.insert(auditLogs).values({
      action: 'delete', entityId: id, entityType: 'permission', ipAddress: context.ipAddress,
      module: 'permissions', oldValues: current, timestamp: Date.now(), userId: administrator.id,
    });
  });
};

export const listRoles = async () => {
  const [roleRows, mappingRows] = await Promise.all([
    db.select().from(roles).orderBy(asc(roles.label)),
    db.select({ permissionId: rolePermissions.permissionId, roleId: rolePermissions.roleId })
      .from(rolePermissions),
  ]);
  const permissionIdsByRole = new Map<number, number[]>();
  mappingRows.forEach(({ permissionId, roleId }) => {
    permissionIdsByRole.set(roleId, [...(permissionIdsByRole.get(roleId) ?? []), permissionId]);
  });
  return roleRows.map((role) => ({ ...role, permissionIds: permissionIdsByRole.get(role.id) ?? [] }));
};

export const getRole = async (idInput: unknown) => {
  const id = roleIdSchema.parse(idInput);
  const role = await findRole(id);
  return { ...role, permissions: await getPermissionRows(id) };
};

export const createRole = async (
  input: unknown,
  administrator: AuthenticatedUser,
  context: AuditContext = {},
) => {
  const data = createRoleSchema.parse(input);
  const name = normalizeRoleName(data.label);
  if (!name) throw new AppError('Role label must contain letters or numbers.', 400);
  const [duplicate] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, name)).limit(1);
  if (duplicate) throw new AppError('A role with this name already exists.', 409);
  await assertPermissionIdsExist(data.permissionIds);

  const id = await db.transaction(async (transaction) => {
    const [generalDataPermission] = await transaction.select({ id: permissions.id }).from(permissions)
      .where(eq(permissions.key, USER_ACCESS.GENERAL_DATA)).limit(1);
    if (!generalDataPermission) throw new AppError('GENERAL_DATA permission is not initialized.', 500);
    const result = await transaction.insert(roles).values({
      description: data.description ?? null,
      isSystem: false,
      label: data.label,
      name,
    });
    const roleId = Number(result[0].insertId);
    const assignedPermissionIds = [...data.permissionIds, generalDataPermission.id];
    for (const key of data.permissionKeys) {
      const [existing] = await transaction.select({ id: permissions.id }).from(permissions)
        .where(eq(permissions.key, key)).limit(1);
      if (existing) {
        assignedPermissionIds.push(existing.id);
      } else {
        const permissionResult = await transaction.insert(permissions).values({
          category: key.split('.')[0],
          description: null,
          isSystem: false,
          key,
          mainCategory: key.split('.')[0],
          module: key.split('.')[0],
          priority: 100,
          title: key.split('.').map((part) => part.replace(/_/g, ' ')).join(' — '),
        });
        assignedPermissionIds.push(Number(permissionResult[0].insertId));
      }
    }
    const uniquePermissionIds = [...new Set(assignedPermissionIds)];
    if (uniquePermissionIds.length) {
      await transaction.insert(rolePermissions).values(
        uniquePermissionIds.map((permissionId) => ({ permissionId, roleId })),
      );
    }
    await transaction.insert(auditLogs).values({
      action: 'create', entityId: roleId, entityType: 'role', ipAddress: context.ipAddress,
      module: 'roles', newValues: { ...data, name, permissionIds: uniquePermissionIds }, timestamp: Date.now(), userId: administrator.id,
    });
    return roleId;
  });
  return getRole(id);
};

export const updateRole = async (
  idInput: unknown,
  input: unknown,
  administrator: AuthenticatedUser,
  context: AuditContext = {},
) => {
  const id = roleIdSchema.parse(idInput);
  const data = updateRoleSchema.parse(input);
  const current = await findRole(id);
  if (current.isSystem) throw new AppError('System roles cannot be edited.', 400);
  const label = data.label ?? current.label;
  const name = data.label ? normalizeRoleName(data.label) : current.name;
  if (!name) throw new AppError('Role label must contain letters or numbers.', 400);
  if (name !== current.name) {
    const [duplicate] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, name)).limit(1);
    if (duplicate && duplicate.id !== id) throw new AppError('A role with this name already exists.', 409);
  }
  const description = data.description === undefined ? current.description : data.description;
  await db.transaction(async (transaction) => {
    await transaction.update(roles).set({ description, label, name }).where(eq(roles.id, id));
    await transaction.insert(auditLogs).values({
      action: 'update', entityId: id, entityType: 'role', ipAddress: context.ipAddress, module: 'roles',
      newValues: { description, label, name }, oldValues: current, timestamp: Date.now(), userId: administrator.id,
    });
  });
  return getRole(id);
};

export const replaceRolePermissions = async (
  idInput: unknown,
  input: unknown,
  administrator: AuthenticatedUser,
  context: AuditContext = {},
) => {
  const id = roleIdSchema.parse(idInput);
  const { permissionIds } = replaceRolePermissionsSchema.parse(input);
  const role = await findRole(id);
  if (role.isSystem) throw new AppError('Permissions for system roles cannot be changed.', 400);
  await assertPermissionIdsExist(permissionIds);
  const [generalDataPermission] = await db.select({ id: permissions.id }).from(permissions)
    .where(eq(permissions.key, USER_ACCESS.GENERAL_DATA)).limit(1);
  if (!generalDataPermission) throw new AppError('GENERAL_DATA permission is not initialized.', 500);
  const effectivePermissionIds = [...new Set([...permissionIds, generalDataPermission.id])];
  const oldRows = await getPermissionRows(id);
  await db.transaction(async (transaction) => {
    await transaction.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
    await transaction.insert(rolePermissions).values(effectivePermissionIds.map((permissionId) => ({ permissionId, roleId: id })));
    await transaction.insert(auditLogs).values({
      action: 'assign_permissions', entityId: id, entityType: 'role', ipAddress: context.ipAddress,
      module: 'roles', newValues: { permissionIds: effectivePermissionIds }, oldValues: { permissionIds: oldRows.map(({ id: permissionId }) => permissionId) },
      timestamp: Date.now(), userId: administrator.id,
    });
  });
  return getRole(id);
};

export const deleteRole = async (
  idInput: unknown,
  administrator: AuthenticatedUser,
  context: AuditContext = {},
) => {
  const id = roleIdSchema.parse(idInput);
  const role = await findRole(id);
  if (role.isSystem) throw new AppError('System roles cannot be deleted.', 400);
  const [assignment] = await db.select({ userId: userRoles.userId }).from(userRoles)
    .where(eq(userRoles.roleId, id)).limit(1);
  if (assignment) throw new AppError('This role is assigned to users and cannot be deleted.', 409);
  await db.transaction(async (transaction) => {
    await transaction.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
    await transaction.delete(roles).where(eq(roles.id, id));
    await transaction.insert(auditLogs).values({
      action: 'delete', entityId: id, entityType: 'role', ipAddress: context.ipAddress,
      module: 'roles', oldValues: role, timestamp: Date.now(), userId: administrator.id,
    });
  });
};

export const replaceUserRoles = async (
  userIdInput: unknown,
  input: unknown,
  administrator: AuthenticatedUser,
  context: AuditContext = {},
) => {
  const userId = roleIdSchema.parse(userIdInput);
  const { assignments: requestedAssignments } = userRoleAssignmentsSchema.parse(input);
  const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw new AppError('User not found.', 404);

  const [[pendingRole]] = await Promise.all([
    db.select({ id: roles.id }).from(roles).where(eq(roles.name, USER_ROLES.PENDING)).limit(1),
  ]);
  if (!pendingRole) throw new AppError('Pending User role is not initialized.', 500);
  const fallbackLocationId = administrator.defaultLocationId;
  const assignments: Array<{ locationId: number | null; roleId: number }> = requestedAssignments.length
    ? requestedAssignments
    : [{ locationId: fallbackLocationId ?? null, roleId: pendingRole.id }];
  if (assignments.length > 1 && assignments.some(({ roleId }) => roleId === pendingRole.id)) {
    throw new AppError('Pending User cannot be combined with another role.', 400);
  }

  const roleIds = [...new Set(assignments.map(({ roleId }) => roleId))];
  const locationIds = [...new Set(assignments.map(({ locationId }) => locationId).filter((id): id is number => id !== null))];
  const [roleRows, locationRows, currentAssignments, [adminRole]] = await Promise.all([
    roleIds.length ? db.select({ id: roles.id }).from(roles).where(inArray(roles.id, roleIds)) : [],
    locationIds.length ? db.select({ id: locations.id, isActive: locations.isActive }).from(locations).where(inArray(locations.id, locationIds)) : [],
    db.select({ locationId: userRoles.locationId, roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, userId)),
    db.select({ id: roles.id }).from(roles).where(eq(roles.name, USER_ROLES.ADMIN)).limit(1),
  ]);
  if (roleRows.length !== roleIds.length) throw new AppError('One or more roles do not exist.', 400);
  if (locationRows.length !== locationIds.length || locationRows.some(({ isActive }) => !isActive)) {
    throw new AppError('One or more locations do not exist or are inactive.', 400);
  }
  if (userId === administrator.id && adminRole && !roleIds.includes(adminRole.id)) {
    throw new AppError('You cannot remove your own Administrator role.', 400);
  }

  await db.transaction(async (transaction) => {
    await transaction.delete(userRoles).where(eq(userRoles.userId, userId));
    if (assignments.length) {
      await transaction.insert(userRoles).values(assignments.map(({ locationId, roleId }) => ({
        assignedBy: administrator.id, locationId, roleId, timestamp: Date.now(), userId,
      })));
    }
    await transaction.insert(auditLogs).values({
      action: 'assign_roles', entityId: userId, entityType: 'user', ipAddress: context.ipAddress,
      module: 'users', newValues: { assignments }, oldValues: { assignments: currentAssignments },
      timestamp: Date.now(), userId: administrator.id,
    });
  });
  return { assignments, userId };
};

export const getUserRoleAssignments = async (userIdInput: unknown) => {
  const userId = roleIdSchema.parse(userIdInput);
  const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw new AppError('User not found.', 404);

  const assignments = await db
    .select({
      location: { id: locations.id, name: locations.name },
      role: { id: roles.id, label: roles.label, name: roles.name },
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(locations, eq(userRoles.locationId, locations.id))
    .where(eq(userRoles.userId, userId))
    .orderBy(asc(roles.label), asc(locations.name));

  return { assignments, userId };
};
