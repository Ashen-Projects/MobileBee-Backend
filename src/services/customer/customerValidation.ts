import { z } from 'zod';

export const customerIdSchema = z.coerce.number().int().positive();

export const listCustomersSchema = z.object({
  isActive: z.enum(['all', 'true', 'false']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional().default(''),
}).strict();

export const createCustomerSchema = z.object({
  address: z.string().trim().max(2000).optional().nullable(),
  email: z.string().trim().email().max(255).optional().nullable().or(z.literal('')),
  name: z.string().trim().min(1, 'Customer name is required.').max(255),
  nic: z.string().trim().max(50).optional().nullable(),
  phone: z.string().trim().min(1, 'Phone number is required.').max(30),
}).strict();

export const updateCustomerSchema = createCustomerSchema.partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const updateCustomerStatusSchema = z.object({
  isActive: z.boolean(),
}).strict();
