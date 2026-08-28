import { and, asc, count, desc, eq, inArray, like, ne, or } from 'drizzle-orm';

import { db } from '../../../db';
import { auditLogs, documentSequences, locations, products, supplierProducts, suppliers } from '../../../db/schema';
import { AppError } from '../../../errors/app-error';
import { DOCUMENT_TYPES, TIME_ZONE } from '../../../utils/constants';
import type { AuthenticatedUser } from '../../auth/authService';
import {
  createSupplierSchema,
  entityIdSchema,
  listSuppliersSchema,
  updateSupplierProductStatusSchema,
  updateSupplierSchema,
  updateSupplierStatusSchema,
  upsertSupplierProductSchema,
} from './supplierValidation';

type AuditContext = { ipAddress?: string };
type SupplierRow = typeof suppliers.$inferSelect;

const audit = (user: AuthenticatedUser, context: AuditContext, values: {
  action: string;
  entityId: number;
  entityType?: string;
  newValues?: unknown;
  oldValues?: unknown;
}) => ({
  ...values,
  entityType: values.entityType ?? 'supplier',
  ipAddress: context.ipAddress,
  module: 'suppliers',
  timestamp: Date.now(),
  userId: user.id,
});

const findSupplier = async (id: number): Promise<SupplierRow> => {
  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  if (!supplier) throw new AppError('Supplier not found.', 404);
  return supplier;
};

const assertUniqueSupplier = async (name: string, code?: string, excludedId?: number) => {
  const duplicate = code
    ? or(eq(suppliers.name, name), eq(suppliers.code, code))
    : eq(suppliers.name, name);
  const [row] = await db.select({ code: suppliers.code, id: suppliers.id, name: suppliers.name })
    .from(suppliers).where(excludedId ? and(ne(suppliers.id, excludedId), duplicate) : duplicate).limit(1);
  if (!row) return;
  if (row.code === code) throw new AppError('A supplier with this code already exists.', 409);
  throw new AppError('A supplier with this name already exists.', 409);
};

const currentYear = () => Number(new Intl.DateTimeFormat('en', {
  timeZone: TIME_ZONE,
  year: 'numeric',
}).format(new Date()));

const formatSupplierCode = (value: number) => `SUP-${String(value).padStart(6, '0')}`;
const formatSupplierProductCode = (supplierId: number, productId: number) => (
  `SP-S${String(supplierId).padStart(6, '0')}-P${String(productId).padStart(6, '0')}`
);

export const reserveSupplierCode = async () => db.transaction(async (transaction) => {
  const [location] = await transaction.select({ id: locations.id }).from(locations)
    .where(eq(locations.isActive, true)).orderBy(asc(locations.id)).limit(1);
  if (!location) throw new AppError('An active location is required before supplier codes can be generated.', 409);

  const year = currentYear();
  await transaction.insert(documentSequences).values({
    documentType: DOCUMENT_TYPES.SUPPLIER_CODE,
    lastNumber: 0,
    locationId: location.id,
    prefix: 'SUP',
    year,
  }).onDuplicateKeyUpdate({ set: { prefix: 'SUP' } });

  const [sequence] = await transaction.select().from(documentSequences).where(and(
    eq(documentSequences.documentType, DOCUMENT_TYPES.SUPPLIER_CODE),
    eq(documentSequences.locationId, location.id),
    eq(documentSequences.year, year),
  )).limit(1).for('update');
  if (!sequence) throw new AppError('Supplier code sequence could not be initialized.', 500);

  const nextNumber = Number(sequence.lastNumber) + 1;
  await transaction.update(documentSequences).set({ lastNumber: nextNumber })
    .where(eq(documentSequences.id, sequence.id));
  return { code: formatSupplierCode(nextNumber) };
});

export const listSuppliers = async (input: unknown) => {
  const query = listSuppliersSchema.parse(input);
  const filters = [];
  if (query.isActive !== 'all') filters.push(eq(suppliers.isActive, query.isActive === 'true'));
  if (query.search) filters.push(or(
    like(suppliers.name, `%${query.search}%`),
    like(suppliers.code, `%${query.search}%`),
    like(suppliers.contactPerson, `%${query.search}%`),
    like(suppliers.phone, `%${query.search}%`),
    like(suppliers.email, `%${query.search}%`),
  ));
  const where = filters.length ? and(...filters) : undefined;
  const offset = (query.page - 1) * query.pageSize;
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(suppliers).where(where).orderBy(asc(suppliers.name), desc(suppliers.id))
      .limit(query.pageSize).offset(offset),
    db.select({ total: count() }).from(suppliers).where(where),
  ]);
  const mappings = rows.length ? await db.select({ supplierId: supplierProducts.supplierId })
    .from(supplierProducts).where(and(
      inArray(supplierProducts.supplierId, rows.map(({ id }) => id)),
      eq(supplierProducts.isActive, true),
    )) : [];
  const productCount = mappings.reduce((result, { supplierId }) => {
    result.set(supplierId, (result.get(supplierId) ?? 0) + 1);
    return result;
  }, new Map<number, number>());
  return {
    items: rows.map((row) => ({ ...row, productCount: productCount.get(row.id) ?? 0 })),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / query.pageSize),
    },
  };
};

export const getSupplier = async (idInput: unknown) => {
  const supplier = await findSupplier(entityIdSchema.parse(idInput));
  const linkedProducts = await db.select({
    id: supplierProducts.id,
    isActive: supplierProducts.isActive,
    isPreferred: supplierProducts.isPreferred,
    lastPurchasingPrice: supplierProducts.lastPurchasingPrice,
    leadTimeDays: supplierProducts.leadTimeDays,
    minimumOrderQty: supplierProducts.minimumOrderQty,
    productId: products.id,
    productName: products.name,
    productSku: products.sku,
    quotedPrice: supplierProducts.quotedPrice,
    supplierProductCode: supplierProducts.supplierProductCode,
    supplierProductName: supplierProducts.supplierProductName,
    timestamp: supplierProducts.timestamp,
  }).from(supplierProducts).innerJoin(products, eq(supplierProducts.productId, products.id))
    .where(eq(supplierProducts.supplierId, supplier.id)).orderBy(desc(supplierProducts.isPreferred), asc(products.name));
  return { ...supplier, products: linkedProducts };
};

export const createSupplier = async (input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const data = createSupplierSchema.parse(input);
  const code = data.code ?? (await reserveSupplierCode()).code;
  await assertUniqueSupplier(data.name, code);
  const id = await db.transaction(async (transaction) => {
    const result = await transaction.insert(suppliers).values({
      ...data,
      code,
    });
    const supplierId = Number(result[0].insertId);
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: 'create', entityId: supplierId, newValues: { ...data, code },
    }));
    return supplierId;
  });
  return getSupplier(id);
};

export const updateSupplier = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = entityIdSchema.parse(idInput);
  const data = updateSupplierSchema.parse(input);
  const current = await findSupplier(id);
  if (data.code && data.code !== current.code) {
    throw new AppError('Supplier codes are generated by Mobee and cannot be changed.', 400);
  }
  await assertUniqueSupplier(data.name ?? current.name, data.code ?? current.code, id);
  await db.transaction(async (transaction) => {
    await transaction.update(suppliers).set(data).where(eq(suppliers.id, id));
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: 'update', entityId: id, newValues: data, oldValues: current,
    }));
  });
  return getSupplier(id);
};

export const setSupplierStatus = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = entityIdSchema.parse(idInput);
  const { isActive } = updateSupplierStatusSchema.parse(input);
  const current = await findSupplier(id);
  if (current.isActive === isActive) return getSupplier(id);
  await db.transaction(async (transaction) => {
    await transaction.update(suppliers).set({ isActive }).where(eq(suppliers.id, id));
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: isActive ? 'activate' : 'deactivate', entityId: id,
      newValues: { isActive }, oldValues: { isActive: current.isActive },
    }));
  });
  return getSupplier(id);
};

export const upsertSupplierProduct = async (supplierIdInput: unknown, productIdInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const supplierId = entityIdSchema.parse(supplierIdInput);
  const productId = entityIdSchema.parse(productIdInput);
  const parsedData = upsertSupplierProductSchema.parse(input);
  const data = {
    ...parsedData,
    supplierProductCode: formatSupplierProductCode(supplierId, productId),
  };
  const supplier = await findSupplier(supplierId);
  if (!supplier.isActive) throw new AppError('Products cannot be linked to an inactive supplier.', 409);
  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!product) throw new AppError('Product not found.', 404);
  if (product.hasVariations) throw new AppError('Link the sellable child variation instead of its variable parent.', 400);
  const [current] = await db.select().from(supplierProducts).where(and(
    eq(supplierProducts.supplierId, supplierId), eq(supplierProducts.productId, productId),
  )).limit(1);
  const timestamp = Date.now();
  await db.transaction(async (transaction) => {
    await transaction.insert(supplierProducts).values({ ...data, productId, supplierId, timestamp })
      .onDuplicateKeyUpdate({ set: { ...data, timestamp } });
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: current ? 'update_product_link' : 'create_product_link',
      entityId: current?.id ?? supplierId,
      entityType: 'supplier_product',
      newValues: { ...data, productId, supplierId },
      oldValues: current,
    }));
  });
  return getSupplier(supplierId);
};

export const setSupplierProductStatus = async (supplierIdInput: unknown, productIdInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const supplierId = entityIdSchema.parse(supplierIdInput);
  const productId = entityIdSchema.parse(productIdInput);
  const { isActive } = updateSupplierProductStatusSchema.parse(input);
  await findSupplier(supplierId);
  const [current] = await db.select().from(supplierProducts).where(and(
    eq(supplierProducts.supplierId, supplierId), eq(supplierProducts.productId, productId),
  )).limit(1);
  if (!current) throw new AppError('Supplier product link not found.', 404);
  if (current.isActive === isActive) return getSupplier(supplierId);
  await db.transaction(async (transaction) => {
    await transaction.update(supplierProducts).set({ isActive, timestamp: Date.now() }).where(eq(supplierProducts.id, current.id));
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: isActive ? 'activate_product_link' : 'deactivate_product_link',
      entityId: current.id,
      entityType: 'supplier_product',
      newValues: { isActive }, oldValues: { isActive: current.isActive },
    }));
  });
  return getSupplier(supplierId);
};
