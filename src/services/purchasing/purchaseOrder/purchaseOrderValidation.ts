import { z } from 'zod';

const entityId = z.coerce.number().int().positive();
const note = z.string().trim().max(2_000).optional();
const item = z.object({
  productId: entityId,
  quantity: z.coerce.number().int().positive().max(1_000_000),
  unitPrice: z.coerce.number().finite().positive().max(9_999_999_999.99),
}).strict();

const uniqueProducts = (items: Array<{ productId: number }>) => (
  new Set(items.map(({ productId }) => productId)).size === items.length
);

export const entityIdSchema = entityId;

export const listPurchaseOrdersSchema = z.object({
  locationId: z.union([entityId, z.literal('all')]).default('all'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).default(''),
  status: z.string().trim().max(100).default('all'),
  supplierId: z.union([entityId, z.literal('all')]).default('all'),
}).strict();

export const createPurchaseOrderSchema = z.object({
  items: z.array(item).min(1).max(500).refine(uniqueProducts, 'A product can appear only once.'),
  locationId: entityId,
  note,
  supplierId: entityId,
}).strict();

export const updatePurchaseOrderSchema = z.object({
  items: z.array(item).min(1).max(500).refine(uniqueProducts, 'A product can appear only once.').optional(),
  locationId: entityId.optional(),
  note,
  supplierId: entityId.optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'At least one field is required.');

export const transitionPurchaseOrderSchema = z.object({ note }).strict();

