import { z } from 'zod';

const money = z.coerce.number().finite().min(0).max(999999999.99);
const note = z.string().trim().max(2000).optional();
const entityId = z.coerce.number().int().positive();
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const openDrawerSchema = z.object({
  note,
  openingCash: money,
}).strict();

export const closeDrawerSchema = z.object({
  cashExpenseAmount: money.default(0),
  countedBankTransferTotal: money.default(0),
  countedCardTotal: money.default(0),
  countedCash: money,
  countedMobileTotal: money.default(0),
  note,
}).strict();

/**
 * Closed drawer reports are operational records, not sale receipts.  The
 * inputs are deliberately bounded so a report view cannot become an
 * unbounded database export.
 */
export const drawerCloseHistorySchema = z.object({
  fromDate: dateString.optional(),
  locationId: z.union([entityId, z.literal('all')]).default('all'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  toDate: dateString.optional(),
}).strict();

export const drawerCloseReportIdSchema = entityId;

/** A saved drawer report may also show all completed sales for its location on one local business day. */
export const drawerLocationDaySchema = z.object({
  date: dateString,
}).strict();
