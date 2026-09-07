import { z } from 'zod';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD date format.');

export const dashboardQuerySchema = z.object({
  fromDate: dateString.optional(),
  locationId: z.union([z.coerce.number().int().positive(), z.literal('all')]).default('all'),
  toDate: dateString.optional(),
}).strict().superRefine((data, context) => {
  if (!data.fromDate || !data.toDate) return;
  const from = Date.parse(`${data.fromDate}T00:00:00.000Z`);
  const to = Date.parse(`${data.toDate}T00:00:00.000Z`);
  if (from > to) {
    context.addIssue({ code: 'custom', message: 'The start date cannot be after the end date.', path: ['fromDate'] });
    return;
  }
  if (Math.floor((to - from) / 86_400_000) > 366) {
    context.addIssue({ code: 'custom', message: 'The selected date range cannot exceed 367 days.', path: ['toDate'] });
  }
});
