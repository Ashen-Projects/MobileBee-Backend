import { z } from 'zod';

const entityId = z.coerce.number().int().positive();
const paymentMethod = z.enum(['cash', 'card', 'bankTransfer', 'mobile']);
const payment = z.object({
  amount: z.coerce.number().finite().positive().max(99_999_999.99),
  method: paymentMethod,
  referenceNo: z.string().trim().max(255).optional(),
}).superRefine((value, context) => {
  if (value.method !== 'cash' && !value.referenceNo) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'A reference number is required for non-cash payments.', path: ['referenceNo'] });
  }
});

export const saleReturnLookupSchema = z.object({
  search: z.string().trim().min(1, 'Scan the original item barcode or enter the original invoice number.').max(100),
}).strict();

export const createSaleExchangeSchema = z.object({
  originalSaleId: entityId,
  reason: z.string().trim().min(3, 'Enter the reason for this exchange.').max(1_000),
  returnedItems: z.array(z.object({
    disposition: z.enum(['restock', 'damage']),
    stockId: entityId,
  })).min(1, 'Select at least one original item to return.').max(100)
    .refine((items) => new Set(items.map((item) => item.stockId)).size === items.length, 'Each returned stock unit can be selected once.'),
  replacementStockIds: z.array(entityId).min(1, 'Add at least one replacement item.').max(100)
    .refine((items) => new Set(items).size === items.length, 'Each replacement stock unit can be selected once.'),
  payments: z.array(payment).max(4).default([])
    .refine((items) => new Set(items.map((item) => item.method)).size === items.length, 'Use each payment method only once.'),
}).strict();

export const saleReturnIdSchema = entityId;

export const listSaleReturnsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).default(''),
}).strict();
