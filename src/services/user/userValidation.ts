import { z } from 'zod';

const nameSchema = z.string().trim().min(1).max(100);
const emailSchema = z.email().transform((value) => value.trim().toLowerCase());

export const createUserSchema = z.object({
  email: emailSchema,
  firstName: nameSchema,
  lastName: nameSchema,
}).strict();

export const listUsersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).default(''),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
});

export const updateUserSchema = z
  .object({
    address: z.string().trim().max(1000).nullable().optional(),
    phone: z.string().trim().max(30).nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, 'At least one field is required.');

export const updateUserStatusSchema = z.object({ isActive: z.boolean() });
export const updateUserLocationSchema = z.object({ locationId: z.coerce.number().int().positive() }).strict();

export const userIdSchema = z.coerce.number().int().positive();
