import { and, asc, eq } from 'drizzle-orm';

import { db } from '../../db';
import { auditLogs, documentSequences, locations } from '../../db/schema';
import { AppError } from '../../errors/app-error';
import type { AuthenticatedUser } from '../auth/authService';
import {
  createDocumentSequenceSchema,
  documentSequenceIdSchema,
  listDocumentSequencesSchema,
  updateDocumentSequenceSchema,
} from './documentSequenceValidation';

type AuditContext = { ipAddress?: string };

const findSequence = async (id: number) => {
  const [sequence] = await db.select().from(documentSequences).where(eq(documentSequences.id, id)).limit(1);
  if (!sequence) throw new AppError('Document sequence not found.', 404);
  return sequence;
};

const audit = (user: AuthenticatedUser, context: AuditContext, action: string, entityId: number, oldValues?: unknown, newValues?: unknown) => ({
  action,
  entityId,
  entityType: 'document_sequence',
  ipAddress: context.ipAddress,
  module: 'document_sequences',
  newValues,
  oldValues,
  timestamp: Date.now(),
  userId: user.id,
});

export const listDocumentSequences = async (input: unknown) => {
  const query = listDocumentSequencesSchema.parse(input);
  const filters = [];
  if (query.documentType !== 'all') filters.push(eq(documentSequences.documentType, query.documentType));
  if (query.locationId !== 'all') filters.push(eq(documentSequences.locationId, query.locationId));
  if (query.year !== 'all') filters.push(eq(documentSequences.year, query.year));
  return db.select({
    documentType: documentSequences.documentType,
    id: documentSequences.id,
    lastNumber: documentSequences.lastNumber,
    locationCode: locations.code,
    locationId: documentSequences.locationId,
    locationName: locations.name,
    prefix: documentSequences.prefix,
    year: documentSequences.year,
  }).from(documentSequences).leftJoin(locations, eq(documentSequences.locationId, locations.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(documentSequences.documentType), asc(locations.name), asc(documentSequences.year));
};

export const getDocumentSequence = async (input: unknown) => findSequence(documentSequenceIdSchema.parse(input));

export const createDocumentSequence = async (input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const data = createDocumentSequenceSchema.parse(input);
  const [location] = await db.select().from(locations).where(eq(locations.id, data.locationId)).limit(1);
  if (!location) throw new AppError('Location not found.', 404);
  const [existing] = await db.select({ id: documentSequences.id }).from(documentSequences).where(and(
    eq(documentSequences.documentType, data.documentType),
    eq(documentSequences.locationId, data.locationId),
    eq(documentSequences.year, data.year),
  )).limit(1);
  if (existing) throw new AppError('A sequence already exists for this document type, location, and year.', 409);
  const id = await db.transaction(async (transaction) => {
    const result = await transaction.insert(documentSequences).values({
      documentType: data.documentType,
      lastNumber: data.startingNumber,
      locationId: data.locationId,
      prefix: data.prefix,
      year: data.year,
    });
    const sequenceId = Number(result[0].insertId);
    await transaction.insert(auditLogs).values(audit(user, context, 'create', sequenceId, undefined, data));
    return sequenceId;
  });
  return findSequence(id);
};

export const updateDocumentSequence = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = documentSequenceIdSchema.parse(idInput);
  const data = updateDocumentSequenceSchema.parse(input);
  const current = await findSequence(id);
  if (current.prefix === data.prefix) return current;
  await db.transaction(async (transaction) => {
    await transaction.update(documentSequences).set({ prefix: data.prefix }).where(eq(documentSequences.id, id));
    await transaction.insert(auditLogs).values(audit(user, context, 'update_prefix', id, { prefix: current.prefix }, data));
  });
  return findSequence(id);
};
