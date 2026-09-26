import { z } from 'zod';

const entityId = z.coerce.number().int().positive();

export const stockDamageEntityIdSchema = entityId;

export const STOCK_DAMAGE_REASONS = [
  'physical_damage',
  'water_damage',
  'manufacturing_defect',
  'packaging_damage',
  'expired_or_obsolete',
  'other',
] as const;

export type StockDamageReason = (typeof STOCK_DAMAGE_REASONS)[number];

export const stockDamageReasonLabels: Record<StockDamageReason, string> = {
  expired_or_obsolete: 'Expired or obsolete',
  manufacturing_defect: 'Manufacturing defect',
  other: 'Other',
  packaging_damage: 'Packaging damage',
  physical_damage: 'Physical damage',
  water_damage: 'Water damage',
};

export const scanStockDamageSchema = z.object({
  code: z.string().trim().min(1, 'Scan or enter a barcode, IMEI, or serial number.').max(64),
}).strict();

export const createStockDamageSchema = z.object({
  note: z.string().trim().max(512).optional(),
  reason: z.enum(STOCK_DAMAGE_REASONS),
  stockIds: z.array(entityId).min(1, 'Scan at least one available stock unit.').max(100)
    .refine((values) => new Set(values).size === values.length, 'Each stock unit can be added only once.'),
}).strict();

export const declineStockDamageSchema = z.object({
  note: z.string().trim().max(512).optional(),
}).strict();

export const listStockDamageSchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).default(''),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict().superRefine((value, context) => {
  if (value.fromDate && value.toDate && value.fromDate > value.toDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'From date must be before or equal to the to date.', path: ['toDate'] });
  }
});
