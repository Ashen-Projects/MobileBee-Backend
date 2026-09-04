import { z } from 'zod';

const numericString = z.coerce.number().min(0);
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD date format.');

export const listSalesSchema = z.object({
  fromDate: dateString.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional().default(''),
  status: z.enum(['all', 'draft', 'completed', 'cancelled', 'returned']).default('all'),
  toDate: dateString.optional(),
}).strict();

export const dailySalesSummarySchema = z.object({
  fromDate: dateString,
  toDate: dateString,
}).strict();

export const searchSaleProductsSchema = z.object({
  locationId: z.union([z.coerce.number().int().positive(), z.literal('all')]).default('all'),
  search: z.string().trim().min(1, 'Search product name, SKU, barcode, IMEI, or serial number.').max(100),
}).strict();

export const searchSaleCustomersSchema = z.object({
  search: z.string().trim().min(1, 'Search customer by phone number or name.').max(100),
}).strict();

export const saleIdSchema = z.coerce.number().int().positive();

export const createSaleSchema = z.object({
  customer: z.object({
    id: z.number().int().positive().optional(),
    name: z.string().trim().min(1, 'Customer name is required.').max(255).optional(),
    phone: z.string().trim().min(1, 'Customer phone number is required.').max(30).optional(),
  }).optional().superRefine((customer, ctx) => {
    if (!customer || customer.id) return;
    if (!customer.name) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Customer name is required.', path: ['name'] });
    }
    if (!customer.phone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Customer phone number is required.', path: ['phone'] });
    }
  }),
  discountAmount: numericString.default(0),
  items: z.array(z.object({
    discountAmount: numericString.default(0),
    productId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    stockIds: z.array(z.number().int().positive()).min(1),
    unitPrice: numericString,
  })).min(1, 'Add at least one product to the sale.'),
  locationId: z.number().int().positive(),
  payment: z.object({
    amount: numericString,
    method: z.enum(['cash', 'card', 'bankTransfer']),
    referenceNo: z.string().trim().max(255).optional(),
  }),
}).strict();
