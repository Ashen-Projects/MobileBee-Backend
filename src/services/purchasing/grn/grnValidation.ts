import { z } from 'zod';

const entityId = z.coerce.number().int().positive();
const money = z.coerce.number().finite().positive().max(9_999_999_999.99);
const code = z.string().trim().min(1).max(64);

const identifier = z.object({
  isPrimary: z.boolean().optional().default(false),
  type: z.enum(['imei', 'serial']),
  value: code,
}).strict();

const unit = z.object({
  barcode: code.optional(),
  generateBarcode: z.boolean().optional().default(false),
  identifiers: z.array(identifier).max(4).optional().default([]),
}).strict().superRefine((value, context) => {
  if (value.barcode && value.generateBarcode) {
    context.addIssue({ code: 'custom', message: 'Provide a barcode or request generation, not both.' });
  }
  if (!value.barcode && !value.generateBarcode && value.identifiers.length === 0) {
    context.addIssue({ code: 'custom', message: 'Every unit requires a barcode, IMEI, serial number, or generated barcode.' });
  }
  if (value.identifiers.filter(({ isPrimary }) => isPrimary).length > 1) {
    context.addIssue({ code: 'custom', message: 'A unit can have only one primary identifier.' });
  }
});

const receivedItem = z.object({
  purchaseOrderItemId: entityId,
  quantity: z.coerce.number().int().positive().max(100_000),
  unitCost: money,
}).strict();

export const grnEntityIdSchema = entityId;
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const listGrnsSchema = z.object({
  fromDate: dateString.optional(),
  locationId: z.union([entityId, z.literal('all')]).default('all'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  purchaseOrderId: z.union([entityId, z.literal('all')]).default('all'),
  search: z.string().trim().max(255).default(''),
  status: z.enum(['pendingCountApproval', 'pendingFinanceApproval', 'approved', 'declined', 'all']).default('all'),
  supplierId: z.union([entityId, z.literal('all')]).default('all'),
  toDate: dateString.optional(),
}).strict();

export const createGrnSchema = z.object({
  documents: z.array(z.object({
    documentType: z.string().trim().min(1).max(80),
    fileName: z.string().trim().min(1).max(255),
    fileUrl: z.string().trim().url().max(1024),
  }).strict()).max(20).optional().default([]),
  items: z.array(receivedItem).min(1).max(500)
    .refine((items) => new Set(items.map(({ purchaseOrderItemId }) => purchaseOrderItemId)).size === items.length, {
      message: 'A purchase-order item can appear only once.',
    }),
  note: z.string().trim().max(2_000).optional(),
  purchaseOrderId: entityId,
  supplierDeliveryNote: z.string().trim().max(150).optional(),
}).strict();

export const verifyGrnCountSchema = z.object({
  countNumber: z.enum(['first', 'second']),
  items: z.array(z.object({
    grnItemId: entityId,
    countedQuantity: z.coerce.number().int().min(0).max(100_000),
  }).strict()).min(1).max(500)
    .refine((items) => new Set(items.map(({ grnItemId }) => grnItemId)).size === items.length, 'Each GRN item can be counted once.'),
}).strict();

export const addGrnStockSchema = z.object({
  items: z.array(z.object({
    grnItemId: entityId,
    units: z.array(unit).min(1).max(100_000),
  }).strict()).min(1).max(500)
    .refine((items) => new Set(items.map(({ grnItemId }) => grnItemId)).size === items.length, 'A GRN item can appear only once.'),
}).strict();

export const financeDecisionSchema = z.object({
  note: z.string().trim().max(2_000).optional(),
  status: z.enum(['approved', 'declined']),
}).strict();

export const addGrnDocumentsSchema = z.object({
  documents: z.array(z.object({
    documentType: z.string().trim().min(1).max(80),
    fileName: z.string().trim().min(1).max(255),
    fileUrl: z.string().trim().url().max(1024),
  }).strict()).min(1).max(20),
}).strict();

export const addGrnNoteSchema = z.object({
  note: z.string().trim().min(1).max(2_000),
}).strict();
