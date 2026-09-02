import { z } from 'zod';

export const locationIdSchema = z.coerce.number().int().positive();

const nullableText = (maximum: number) => z.string().trim().max(maximum).nullable().optional()
  .transform((value) => value === '' ? null : value);

const locationFields = {
  address: nullableText(2_000),
  code: z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(255),
  phone: z.string().trim().max(30).regex(/^[0-9+()\-\s]*$/).nullable().optional()
    .transform((value) => value === '' ? null : value),
  type: z.enum(['shop', 'warehouse', 'repairCentre']),
};

export const listLocationsSchema = z.object({
  isActive: z.enum(['true', 'false', 'all']).default('all'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).default(''),
  type: z.union([locationFields.type, z.literal('all')]).default('all'),
}).strict();

export const createLocationSchema = z.object({
  ...locationFields,
  isActive: z.boolean().default(true),
}).strict();

export const updateLocationSchema = z.object({
  address: locationFields.address,
  code: locationFields.code.optional(),
  name: locationFields.name.optional(),
  phone: locationFields.phone,
  type: locationFields.type.optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'At least one field is required.');

export const updateLocationStatusSchema = z.object({ isActive: z.boolean() }).strict();
