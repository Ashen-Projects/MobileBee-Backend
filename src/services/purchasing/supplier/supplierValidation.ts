import { z } from 'zod';

const nullableText = (maximum: number) => z.string().trim().max(maximum).nullable().optional()
  .transform((value) => value === '' ? null : value);
const money = z.coerce.number().finite().min(0).max(9_999_999_999.99)
  .transform((value) => value.toFixed(2));
const supplierCode = z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/)
  .transform((value) => value.toUpperCase());
const reservedSupplierCode = z.string().trim().regex(/^SUP-\d{6,}$/, 'A valid reserved supplier code is required.');

export const entityIdSchema = z.coerce.number().int().positive();

export const listSuppliersSchema = z.object({
  isActive: z.enum(['true', 'false', 'all']).default('all'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).default(''),
}).strict();

const supplierFields = {
  address: nullableText(2_000),
  code: supplierCode,
  contactPerson: nullableText(255),
  creditLimit: money.default('0.00'),
  email: z.union([z.email().max(255), z.literal('')]).nullable().optional()
    .transform((value) => value === '' ? null : value?.toLowerCase()),
  name: z.string().trim().min(1).max(255),
  paymentTermDays: z.coerce.number().int().min(0).max(3_650).default(0),
  phone: z.string().trim().max(30).regex(/^[0-9+()\-\s]*$/).nullable().optional()
    .transform((value) => value === '' ? null : value),
};

export const createSupplierSchema = z.object({
  ...supplierFields,
  code: reservedSupplierCode.optional(),
  isActive: z.boolean().default(true),
}).strict();

export const updateSupplierSchema = z.object({
  address: supplierFields.address,
  code: supplierFields.code.optional(),
  contactPerson: supplierFields.contactPerson,
  creditLimit: money.optional(),
  email: supplierFields.email,
  name: supplierFields.name.optional(),
  paymentTermDays: z.coerce.number().int().min(0).max(3_650).optional(),
  phone: supplierFields.phone,
}).strict().refine((data) => Object.keys(data).length > 0, 'At least one field is required.');

export const updateSupplierStatusSchema = z.object({ isActive: z.boolean() }).strict();

export const upsertSupplierProductSchema = z.object({
  isActive: z.boolean().default(true),
  isPreferred: z.boolean().default(false),
  lastPurchasingPrice: money.nullable().optional(),
  leadTimeDays: z.coerce.number().int().min(0).max(3_650).nullable().optional(),
  minimumOrderQty: z.coerce.number().int().positive().max(1_000_000).default(1),
  quotedPrice: money.nullable().optional(),
  supplierProductCode: nullableText(255),
  supplierProductName: nullableText(255),
}).strict();

export const updateSupplierProductStatusSchema = z.object({ isActive: z.boolean() }).strict();
