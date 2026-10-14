import { z } from 'zod';

const numericString = z.coerce.number().finite().min(0).max(99_999_999.99);
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD date format.');
const paymentMethod = z.enum(['cash', 'card', 'bankTransfer', 'mobile']);
const paymentLineSchema = z.object({
  amount: z.coerce.number().finite().positive('Enter an amount greater than zero.').max(99_999_999.99),
  method: paymentMethod,
  referenceNo: z.string().trim().max(255).optional(),
}).superRefine((payment, context) => {
  if (payment.method !== 'cash' && !payment.referenceNo) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'A reference number is required for non-cash payments.', path: ['referenceNo'] });
  }
});

export const listSalesSchema = z.object({
  fromDate: dateString.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  paymentMethod: z.enum(['all', 'cash', 'card', 'bankTransfer', 'finance', 'mobile']).default('all'),
  search: z.string().trim().optional().default(''),
  status: z.enum(['all', 'draft', 'completed', 'cancelled', 'returned']).default('all'),
  toDate: dateString.optional(),
}).strict();

export const dailySalesSummarySchema = z.object({
  fromDate: dateString,
  paymentMethod: z.enum(['all', 'cash', 'card', 'bankTransfer', 'finance', 'mobile']).default('all'),
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
  }).superRefine((customer, ctx) => {
    if (customer.id) return;
    if (!customer.name) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Customer name is required.', path: ['name'] });
    }
    if (!customer.phone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Customer phone number is required.', path: ['phone'] });
    }
  }),
  discountAmount: numericString.default(0),
  // Required by the service only when an administrator makes a price-policy exception.
  // It remains optional at the API boundary because normal sales do not need it.
  priceOverrideReason: z.string().trim().max(500).optional(),
  items: z.array(z.object({
    discountAmount: numericString.default(0),
    productId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    stockIds: z.array(z.number().int().positive()).min(1),
    unitPrice: numericString,
  })).min(1, 'Add at least one product to the sale.'),
  locationId: z.number().int().positive(),
  // `payment` is retained temporarily for older clients. New clients must use
  // `payments`, which supports an exact split across the accepted methods.
  payment: paymentLineSchema.optional(),
  payments: z.array(paymentLineSchema).min(1).max(4).optional(),
}).strict().superRefine((sale, context) => {
  if (!sale.payment && !sale.payments?.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Add at least one payment method.', path: ['payments'] });
  }
  if (sale.payment && sale.payments?.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Send either payment or payments, not both.', path: ['payments'] });
  }
  if (sale.payments && new Set(sale.payments.map((payment) => payment.method)).size !== sale.payments.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Use each payment method only once.', path: ['payments'] });
  }
});
