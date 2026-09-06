import { z } from 'zod';

const nullableText = (maximum: number) => z.string().trim().max(maximum).nullable().optional();
const nullableUrl = z.union([z.url().max(1024), z.literal('')]).nullable().optional()
  .transform((value) => value === '' ? null : value);
const money = z.coerce.number().finite().min(0).max(99_999_999.99)
  .transform((value) => value.toFixed(2));
const optionalMoney = money.optional().default('0.00');
const optionalId = z.coerce.number().int().positive().nullable().optional();

export const entityIdSchema = z.coerce.number().int().positive();

export const listProductsSchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  hasVariations: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  isActive: z.enum(['true', 'false', 'all']).default('all'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  parentId: z.coerce.number().int().positive().optional(),
  rootOnly: z.enum(['true', 'false']).transform((value) => value === 'true').default(false),
  search: z.string().trim().max(255).default(''),
}).strict();

export const listCatalogSchema = z.object({
  includeInactive: z.enum(['true', 'false']).transform((value) => value === 'true').default(false),
  search: z.string().trim().max(255).default(''),
}).strict();

const seoSchema = z.object({
  canonicalUrl: nullableUrl,
  keywords: nullableText(512),
  metaDescription: nullableText(512),
  metaTitle: nullableText(255),
  ogImageUrl: nullableUrl,
}).strict();

const imageSchema = z.object({
  altText: nullableText(255),
  isPrimary: z.boolean().default(false),
  priority: z.coerce.number().int().min(0).max(100_000).default(0),
  url: z.url().max(1024),
}).strict();

const productFields = {
  categoryId: optionalId,
  description: nullableText(50_000),
  iconUrl: nullableUrl,
  images: z.array(imageSchema).max(20).default([]),
  isAvailableOnWeb: z.boolean().default(false),
  logoUrl: nullableUrl,
  lowestSellingPrice: optionalMoney,
  maxPurchasingPrice: optionalMoney,
  mrpPrice: optionalMoney,
  name: z.string().trim().min(1).max(255),
  optionIds: z.array(z.coerce.number().int().positive()).max(30).default([])
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate attribute options are not allowed.'),
  priority: z.coerce.number().int().min(0).max(100_000).default(0),
  seo: seoSchema.nullable().optional(),
  shortDescription: nullableText(1024),
  sku: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/).nullable().optional()
    .transform((value) => typeof value === 'string' ? value.toUpperCase() : value),
};

export const createProductSchema = z.object({
  ...productFields,
  hasVariations: z.boolean().default(false),
  isActive: z.boolean().default(true),
  parentId: optionalId,
}).strict().superRefine((data, context) => {
  if (data.parentId && data.hasVariations) {
    context.addIssue({ code: 'custom', message: 'A variation cannot contain its own variations.', path: ['hasVariations'] });
  }
  if (!data.parentId && data.hasVariations && data.optionIds.length > 0) {
    context.addIssue({ code: 'custom', message: 'A variable parent product cannot have attribute options.', path: ['optionIds'] });
  }
  if (data.images.filter(({ isPrimary }) => isPrimary).length > 1) {
    context.addIssue({ code: 'custom', message: 'Only one primary image is allowed.', path: ['images'] });
  }
  if (data.images.length > 0 && data.images.filter(({ isPrimary }) => isPrimary).length === 0) {
    context.addIssue({ code: 'custom', message: 'One product image must be selected as primary.', path: ['images'] });
  }
  if (!data.hasVariations && Number(data.lowestSellingPrice) > 0 && Number(data.mrpPrice) > 0
    && Number(data.lowestSellingPrice) > Number(data.mrpPrice)) {
    context.addIssue({ code: 'custom', message: 'Lowest selling price cannot exceed MRP.', path: ['lowestSellingPrice'] });
  }
});

export const updateProductSchema = z.object({
  categoryId: optionalId,
  description: nullableText(50_000),
  iconUrl: nullableUrl,
  images: z.array(imageSchema).max(20).optional(),
  isAvailableOnWeb: z.boolean().optional(),
  logoUrl: nullableUrl,
  lowestSellingPrice: money.optional(),
  maxPurchasingPrice: money.optional(),
  mrpPrice: money.optional(),
  name: z.string().trim().min(1).max(255).optional(),
  optionIds: z.array(z.coerce.number().int().positive()).max(30).optional()
    .refine((ids) => ids === undefined || new Set(ids).size === ids.length, 'Duplicate attribute options are not allowed.'),
  priority: z.coerce.number().int().min(0).max(100_000).optional(),
  seo: seoSchema.nullable().optional(),
  shortDescription: nullableText(1024),
  sku: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/).nullable().optional()
    .transform((value) => typeof value === 'string' ? value.toUpperCase() : value),
}).strict().refine((data) => Object.keys(data).length > 0, 'At least one field is required.')
  .superRefine((data, context) => {
    if (data.images && data.images.filter(({ isPrimary }) => isPrimary).length > 1) {
      context.addIssue({ code: 'custom', message: 'Only one primary image is allowed.', path: ['images'] });
    }
    if (data.lowestSellingPrice !== undefined && data.mrpPrice !== undefined
      && Number(data.lowestSellingPrice) > 0 && Number(data.mrpPrice) > 0
      && Number(data.lowestSellingPrice) > Number(data.mrpPrice)) {
      context.addIssue({ code: 'custom', message: 'Lowest selling price cannot exceed MRP.', path: ['lowestSellingPrice'] });
    }
  });

export const updateStatusSchema = z.object({ isActive: z.boolean() }).strict();

const slugSchema = z.string().trim().min(1).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const createCategorySchema = z.object({
  description: nullableText(1024),
  iconUrl: nullableUrl,
  isActive: z.boolean().default(true),
  logoUrl: nullableUrl,
  name: z.string().trim().min(1).max(255),
  parentId: optionalId,
  priority: z.coerce.number().int().min(0).max(100_000).default(0),
  requiredAttributeIds: z.array(z.coerce.number().int().positive()).max(50).default([])
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate required attributes are not allowed.'),
  seo: seoSchema.nullable().optional(),
  slug: slugSchema.optional(),
}).strict();

export const updateCategorySchema = z.object({
  description: nullableText(1024),
  iconUrl: nullableUrl,
  logoUrl: nullableUrl,
  name: z.string().trim().min(1).max(255).optional(),
  parentId: optionalId,
  priority: z.coerce.number().int().min(0).max(100_000).optional(),
  requiredAttributeIds: z.array(z.coerce.number().int().positive()).max(50).optional()
    .refine((ids) => ids === undefined || new Set(ids).size === ids.length, 'Duplicate required attributes are not allowed.'),
  seo: seoSchema.nullable().optional(),
  slug: slugSchema.optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'At least one field is required.');

export const createAttributeSchema = z.object({
  description: nullableText(1024),
  displayName: z.string().trim().min(1).max(150),
  isEffectOnDescription: z.boolean().default(false),
  isEffectOnImages: z.boolean().default(false),
  isEffectOnPricing: z.boolean().default(false),
  isActive: z.boolean().default(true),
  name: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/),
  postUnit: nullableText(50),
  preUnit: nullableText(50),
  priority: z.coerce.number().int().min(0).max(100_000).default(0),
}).strict();

export const updateAttributeSchema = z.object({
  description: nullableText(1024),
  displayName: z.string().trim().min(1).max(150).optional(),
  isEffectOnDescription: z.boolean().optional(),
  isEffectOnImages: z.boolean().optional(),
  isEffectOnPricing: z.boolean().optional(),
  name: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/).optional(),
  postUnit: nullableText(50),
  preUnit: nullableText(50),
  priority: z.coerce.number().int().min(0).max(100_000).optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'At least one field is required.');

export const createAttributeOptionSchema = z.object({
  colorHex: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  description: nullableText(1024),
  iconUrl: nullableUrl,
  isActive: z.boolean().default(true),
  label: z.string().trim().min(1).max(150),
  priority: z.coerce.number().int().min(0).max(100_000).default(0),
  value: z.string().trim().min(1).max(150),
}).strict();

export const updateAttributeOptionSchema = z.object({
  colorHex: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  description: nullableText(1024),
  iconUrl: nullableUrl,
  label: z.string().trim().min(1).max(150).optional(),
  priority: z.coerce.number().int().min(0).max(100_000).optional(),
  value: z.string().trim().min(1).max(150).optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'At least one field is required.');
