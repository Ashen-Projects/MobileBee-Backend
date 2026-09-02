import { z } from 'zod';

import { DOCUMENT_TYPES } from '../../utils/constants';

const documentTypes = Object.values(DOCUMENT_TYPES) as [string, ...string[]];
export const documentSequenceIdSchema = z.coerce.number().int().positive();

const prefix = z.string().trim().min(1).max(30).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
  .transform((value) => value.toUpperCase());

export const listDocumentSequencesSchema = z.object({
  documentType: z.union([z.enum(documentTypes), z.literal('all')]).default('all'),
  locationId: z.union([z.coerce.number().int().positive(), z.literal('all')]).default('all'),
  year: z.union([z.coerce.number().int().min(2000).max(9999), z.literal('all')]).default('all'),
}).strict();

export const createDocumentSequenceSchema = z.object({
  documentType: z.enum(documentTypes),
  locationId: z.coerce.number().int().positive(),
  prefix,
  startingNumber: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  year: z.coerce.number().int().min(2000).max(9999),
}).strict();

export const updateDocumentSequenceSchema = z.object({ prefix }).strict();
