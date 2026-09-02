import { z } from 'zod';

const entityId = z.coerce.number().int().positive();

export const listStockSchema = z.object({
  locationId: z.union([entityId, z.literal('all')]).default('all'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).default(''),
  statusId: z.union([entityId, z.literal('all')]).default('all'),
}).strict();

export const listPendingStockReceiptsSchema = z.object({
  locationId: z.union([entityId, z.literal('all')]).default('all'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).default(''),
}).strict();
