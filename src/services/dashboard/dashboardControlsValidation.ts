import { z } from 'zod';

const amount = z.coerce.number().positive().max(99_999_999_999, 'Target amount is too large.');
const positiveDayCount = z.coerce.number().int().min(1).max(365);

export const dashboardTargetSchema = z.object({
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD date format.'),
  locationId: z.coerce.number().int().positive(),
  period: z.enum(['weekly', 'monthly']),
  targetAmount: amount,
}).strict();

export const dashboardInsightSettingsSchema = z.object({
  deadStockDays: positiveDayCount,
  excessStockCoverDays: positiveDayCount,
  overdueSupplierDays: positiveDayCount,
  repairInProgressDays: positiveDayCount,
  repairIntakeDays: positiveDayCount,
  repairWaitingPartsDays: positiveDayCount,
  salesDeclinePercent: z.coerce.number().min(1).max(100),
  slowStockDays: positiveDayCount,
  stockoutCoverDays: positiveDayCount,
  suggestedTargetGrowthPercent: z.coerce.number().min(0).max(100),
}).strict().superRefine((data, context) => {
  if (data.slowStockDays >= data.deadStockDays) {
    context.addIssue({ code: 'custom', message: 'Slow-stock days must be lower than dead-stock days.', path: ['slowStockDays'] });
  }
  if (data.stockoutCoverDays >= data.excessStockCoverDays) {
    context.addIssue({ code: 'custom', message: 'Stockout cover days must be lower than excess stock-cover days.', path: ['stockoutCoverDays'] });
  }
});

export const dashboardInsightActionSchema = z.object({
  locationId: z.union([z.coerce.number().int().positive(), z.literal('all')]),
  note: z.string().trim().max(1000).optional(),
  state: z.enum(['resolved', 'dismissed']),
}).strict();

export const dashboardInsightIdSchema = z.string().trim().regex(/^[a-z0-9-]{3,120}$/, 'Invalid insight identifier.');
