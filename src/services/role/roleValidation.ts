import { z } from 'zod';

const roleLabelSchema = z.string().trim().min(2).max(150);
const roleDescriptionSchema = z.string().trim().max(1000).nullable().optional();
const permissionIdsSchema = z.array(z.coerce.number().int().positive()).max(250).default([])
  .transform((ids) => [...new Set(ids)]);
const permissionKeySchema = z.string().trim().toLowerCase().min(3).max(150)
  .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, 'Permission key must use module.action format, for example customers.create.');

export const roleIdSchema = z.coerce.number().int().positive();

export const createPermissionSchema = z.object({
  category: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(255).nullable().optional(),
  mainCategory: z.string().trim().min(1).max(100).optional(),
  key: permissionKeySchema,
  module: z.string().trim().toLowerCase().min(1).max(80).regex(/^[a-z][a-z0-9_]*$/).optional(),
  priority: z.coerce.number().min(0).max(100000).optional(),
  title: z.string().trim().min(1).max(150).optional(),
}).strict();

export const updatePermissionSchema = createPermissionSchema.partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const createRoleSchema = z.object({
  description: roleDescriptionSchema,
  label: roleLabelSchema,
  permissionIds: permissionIdsSchema,
  permissionKeys: z.array(permissionKeySchema).max(250).default([]).transform((keys) => [...new Set(keys)]),
});

export const updateRoleSchema = z.object({
  description: roleDescriptionSchema,
  label: roleLabelSchema.optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const replaceRolePermissionsSchema = z.object({ permissionIds: permissionIdsSchema });

export const userRoleAssignmentsSchema = z.object({
  assignments: z.array(z.object({
    locationId: z.coerce.number().int().positive().nullable(),
    roleId: z.coerce.number().int().positive(),
  })).max(100).transform((assignments, context) => {
    const keys = assignments.map(({ locationId, roleId }) => `${roleId}:${locationId}`);
    if (new Set(keys).size !== keys.length) {
      context.addIssue({ code: 'custom', message: 'Duplicate role and location assignments are not allowed.' });
      return z.NEVER;
    }
    return assignments;
  }),
});
