import { and, asc, eq, inArray, isNull, like, ne, or } from 'drizzle-orm';

import { db } from '../../db';
import {
  auditLogs,
  productAttributeOptions,
  productAttributes,
  productCategories,
  productCategoryRequiredAttributes,
  productProductAttributeOptions,
  products,
  seo,
} from '../../db/schema';
import { AppError } from '../../errors/app-error';
import type { AuthenticatedUser } from '../auth/authService';
import {
  createAttributeOptionSchema,
  createAttributeSchema,
  createCategorySchema,
  entityIdSchema,
  listCatalogSchema,
  updateAttributeOptionSchema,
  updateAttributeSchema,
  updateCategorySchema,
  updateStatusSchema,
} from './productValidation';

type AuditContext = { ipAddress?: string };

const slugify = (value: string) => value.trim().toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const audit = (user: AuthenticatedUser, context: AuditContext, values: {
  action: string;
  entityId: number;
  entityType: string;
  newValues?: unknown;
  oldValues?: unknown;
}) => ({
  ...values,
  ipAddress: context.ipAddress,
  module: 'products',
  timestamp: Date.now(),
  userId: user.id,
});

const findCategory = async (id: number) => {
  const [row] = await db.select().from(productCategories).where(eq(productCategories.id, id)).limit(1);
  if (!row) throw new AppError('Product category not found.', 404);
  return row;
};

const validateRequiredAttributes = async (ids: number[]) => {
  if (!ids.length) return;
  const rows = await db.select({ id: productAttributes.id, isActive: productAttributes.isActive })
    .from(productAttributes).where(inArray(productAttributes.id, ids));
  if (rows.length !== ids.length) throw new AppError('One or more required product attributes do not exist.', 400);
  if (rows.some(({ isActive }) => !isActive)) throw new AppError('Required product attributes must be active.', 400);
};

const enrichCategories = async (rows: Array<typeof productCategories.$inferSelect>) => {
  const [allCategories, mappings] = await Promise.all([
    db.select().from(productCategories),
    db.select().from(productCategoryRequiredAttributes),
  ]);
  const directIds = (categoryId: number) => mappings.filter((item) => item.categoryId === categoryId)
    .map(({ attributeId }) => attributeId);
  const inheritedIds = (categoryId: number) => {
    const ids = new Set<number>();
    const visited = new Set<number>();
    let currentId: number | null = categoryId;
    while (currentId !== null && !visited.has(currentId)) {
      visited.add(currentId);
      directIds(currentId).forEach((id) => ids.add(id));
      currentId = allCategories.find(({ id }) => id === currentId)?.parentId ?? null;
    }
    return [...ids];
  };
  return rows.map((category) => ({
    ...category,
    inheritedRequiredAttributeIds: inheritedIds(category.id),
    requiredAttributeIds: directIds(category.id),
  }));
};

const assertValidCategoryParent = async (categoryId: number | null, parentId: number | null) => {
  if (parentId === null) return;
  if (parentId === categoryId) throw new AppError('A category cannot be its own parent.', 400);
  const parent = await findCategory(parentId);
  if (!parent.isActive) throw new AppError('The parent category is inactive.', 400);
  let ancestorId = parent.parentId;
  const visited = new Set<number>([parentId]);
  while (ancestorId !== null) {
    if (ancestorId === categoryId) throw new AppError('This category hierarchy would create a cycle.', 400);
    if (visited.has(ancestorId)) throw new AppError('The existing category hierarchy contains a cycle.', 409);
    visited.add(ancestorId);
    const ancestor = await findCategory(ancestorId);
    ancestorId = ancestor.parentId;
  }
};

export const listCategories = async (input: unknown) => {
  const query = listCatalogSchema.parse(input);
  const filters = [];
  if (!query.includeInactive) filters.push(eq(productCategories.isActive, true));
  if (query.search) filters.push(or(
    like(productCategories.name, `%${query.search}%`),
    like(productCategories.slug, `%${query.search}%`),
  ));
  const rows = await db.select().from(productCategories)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(productCategories.priority), asc(productCategories.name));
  return enrichCategories(rows);
};

export const createCategory = async (input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const data = createCategorySchema.parse(input);
  const slug = data.slug ?? slugify(data.name);
  if (!slug) throw new AppError('Category name must contain letters or numbers.', 400);
  await assertValidCategoryParent(null, data.parentId ?? null);
  const [duplicate] = await db.select({ id: productCategories.id }).from(productCategories)
    .where(or(eq(productCategories.slug, slug), and(
      eq(productCategories.name, data.name),
      data.parentId ? eq(productCategories.parentId, data.parentId) : isNull(productCategories.parentId),
    ))).limit(1);
  if (duplicate) throw new AppError('A category with this name or slug already exists.', 409);
  await validateRequiredAttributes(data.requiredAttributeIds);
  const id = await db.transaction(async (transaction) => {
    const { requiredAttributeIds, seo: seoData, ...categoryData } = data;
    let seoId: number | null = null;
    if (seoData) {
      const seoResult = await transaction.insert(seo).values(seoData);
      seoId = Number(seoResult[0].insertId);
    }
    const result = await transaction.insert(productCategories).values({ ...categoryData, parentId: data.parentId ?? null, seoId, slug });
    const categoryId = Number(result[0].insertId);
    if (requiredAttributeIds.length) await transaction.insert(productCategoryRequiredAttributes)
      .values(requiredAttributeIds.map((attributeId) => ({ attributeId, categoryId })));
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: 'create', entityId: categoryId, entityType: 'product_category', newValues: { ...data, slug },
    }));
    return categoryId;
  });
  return (await enrichCategories([await findCategory(id)]))[0];
};

export const updateCategory = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = entityIdSchema.parse(idInput);
  const data = updateCategorySchema.parse(input);
  const current = await findCategory(id);
  if (data.requiredAttributeIds) await validateRequiredAttributes(data.requiredAttributeIds);
  const next = {
    description: data.description === undefined ? current.description : data.description,
    iconUrl: data.iconUrl === undefined ? current.iconUrl : data.iconUrl,
    logoUrl: data.logoUrl === undefined ? current.logoUrl : data.logoUrl,
    name: data.name ?? current.name,
    parentId: data.parentId === undefined ? current.parentId : data.parentId,
    priority: data.priority ?? current.priority,
    slug: data.slug ?? (data.name ? slugify(data.name) : current.slug),
  };
  await assertValidCategoryParent(id, next.parentId);
  const duplicateConditions = [
    eq(productCategories.slug, next.slug),
    and(
      eq(productCategories.name, next.name),
      next.parentId ? eq(productCategories.parentId, next.parentId) : isNull(productCategories.parentId),
    ),
  ];
  const [duplicate] = await db.select({ id: productCategories.id }).from(productCategories)
    .where(and(ne(productCategories.id, id), or(...duplicateConditions))).limit(1);
  if (duplicate) throw new AppError('A category with this slug already exists.', 409);
  await db.transaction(async (transaction) => {
    let seoId = current.seoId;
    if (data.seo === null && seoId) {
      await transaction.update(productCategories).set({ seoId: null }).where(eq(productCategories.id, id));
      await transaction.delete(seo).where(eq(seo.seoId, seoId));
      seoId = null;
    } else if (data.seo) {
      if (seoId) await transaction.update(seo).set(data.seo).where(eq(seo.seoId, seoId));
      else {
        const result = await transaction.insert(seo).values(data.seo);
        seoId = Number(result[0].insertId);
      }
    }
    await transaction.update(productCategories).set({ ...next, seoId }).where(eq(productCategories.id, id));
    if (data.requiredAttributeIds) {
      await transaction.delete(productCategoryRequiredAttributes)
        .where(eq(productCategoryRequiredAttributes.categoryId, id));
      if (data.requiredAttributeIds.length) await transaction.insert(productCategoryRequiredAttributes)
        .values(data.requiredAttributeIds.map((attributeId) => ({ attributeId, categoryId: id })));
    }
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: 'update', entityId: id, entityType: 'product_category', newValues: next, oldValues: current,
    }));
  });
  return (await enrichCategories([{ ...current, ...next }]))[0];
};

export const setCategoryStatus = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = entityIdSchema.parse(idInput);
  const { isActive } = updateStatusSchema.parse(input);
  const current = await findCategory(id);
  if (!isActive) {
    const [[child], [activeProduct]] = await Promise.all([
      db.select({ id: productCategories.id }).from(productCategories)
        .where(and(eq(productCategories.parentId, id), eq(productCategories.isActive, true))).limit(1),
      db.select({ id: products.id }).from(products)
        .where(and(eq(products.categoryId, id), eq(products.isActive, true))).limit(1),
    ]);
    if (child) throw new AppError('Deactivate the child categories first.', 409);
    if (activeProduct) throw new AppError('Deactivate products in this category first.', 409);
  }
  await db.transaction(async (transaction) => {
    await transaction.update(productCategories).set({ isActive }).where(eq(productCategories.id, id));
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: isActive ? 'activate' : 'deactivate', entityId: id, entityType: 'product_category',
      newValues: { isActive }, oldValues: { isActive: current.isActive },
    }));
  });
  return { ...current, isActive };
};

const findAttribute = async (id: number) => {
  const [row] = await db.select().from(productAttributes).where(eq(productAttributes.id, id)).limit(1);
  if (!row) throw new AppError('Product attribute not found.', 404);
  return row;
};

export const listAttributes = async (input: unknown) => {
  const query = listCatalogSchema.parse(input);
  const filters = [];
  if (!query.includeInactive) filters.push(eq(productAttributes.isActive, true));
  if (query.search) filters.push(or(
    like(productAttributes.name, `%${query.search}%`),
    like(productAttributes.displayName, `%${query.search}%`),
  ));
  const [attributeRows, optionRows] = await Promise.all([
    db.select().from(productAttributes).where(filters.length ? and(...filters) : undefined)
      .orderBy(asc(productAttributes.priority), asc(productAttributes.displayName)),
    db.select().from(productAttributeOptions).orderBy(asc(productAttributeOptions.priority), asc(productAttributeOptions.label)),
  ]);
  return attributeRows.map((attribute) => ({
    ...attribute,
    options: optionRows.filter((option) => option.attributeId === attribute.id
      && (query.includeInactive || option.isActive)),
  }));
};

export const createAttribute = async (input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const data = createAttributeSchema.parse(input);
  const [duplicate] = await db.select({ id: productAttributes.id }).from(productAttributes)
    .where(eq(productAttributes.name, data.name)).limit(1);
  if (duplicate) throw new AppError('An attribute with this name already exists.', 409);
  const id = await db.transaction(async (transaction) => {
    const result = await transaction.insert(productAttributes).values(data);
    const attributeId = Number(result[0].insertId);
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: 'create', entityId: attributeId, entityType: 'product_attribute', newValues: data,
    }));
    return attributeId;
  });
  return findAttribute(id);
};

export const updateAttribute = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = entityIdSchema.parse(idInput);
  const data = updateAttributeSchema.parse(input);
  const current = await findAttribute(id);
  if (data.name && data.name !== current.name) {
    const [duplicate] = await db.select({ id: productAttributes.id }).from(productAttributes)
      .where(eq(productAttributes.name, data.name)).limit(1);
    if (duplicate) throw new AppError('An attribute with this name already exists.', 409);
  }
  await db.transaction(async (transaction) => {
    await transaction.update(productAttributes).set(data).where(eq(productAttributes.id, id));
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: 'update', entityId: id, entityType: 'product_attribute', newValues: data, oldValues: current,
    }));
  });
  return { ...current, ...data };
};

export const setAttributeStatus = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = entityIdSchema.parse(idInput);
  const { isActive } = updateStatusSchema.parse(input);
  const current = await findAttribute(id);
  if (!isActive) {
    const [[categoryRequirement], [productUsage]] = await Promise.all([
      db.select({ categoryId: productCategoryRequiredAttributes.categoryId }).from(productCategoryRequiredAttributes)
        .where(eq(productCategoryRequiredAttributes.attributeId, id)).limit(1),
      db.select({ productId: productProductAttributeOptions.productId }).from(productProductAttributeOptions)
        .innerJoin(productAttributeOptions, eq(productProductAttributeOptions.optionId, productAttributeOptions.id))
        .where(eq(productAttributeOptions.attributeId, id)).limit(1),
    ]);
    if (categoryRequirement) throw new AppError('Remove this attribute from all product category requirements before deactivating it.', 409);
    if (productUsage) throw new AppError('This attribute is used by a product and cannot be deactivated.', 409);
  }
  await db.transaction(async (transaction) => {
    await transaction.update(productAttributes).set({ isActive }).where(eq(productAttributes.id, id));
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: isActive ? 'activate' : 'deactivate', entityId: id, entityType: 'product_attribute',
      newValues: { isActive }, oldValues: { isActive: current.isActive },
    }));
  });
  return { ...current, isActive };
};

const findOption = async (id: number) => {
  const [row] = await db.select().from(productAttributeOptions).where(eq(productAttributeOptions.id, id)).limit(1);
  if (!row) throw new AppError('Product attribute option not found.', 404);
  return row;
};

export const createAttributeOption = async (
  attributeIdInput: unknown,
  input: unknown,
  user: AuthenticatedUser,
  context: AuditContext = {},
) => {
  const attributeId = entityIdSchema.parse(attributeIdInput);
  const data = createAttributeOptionSchema.parse(input);
  const attribute = await findAttribute(attributeId);
  if (!attribute.isActive) throw new AppError('Activate the attribute before adding options.', 400);
  const [duplicate] = await db.select({ id: productAttributeOptions.id }).from(productAttributeOptions)
    .where(and(eq(productAttributeOptions.attributeId, attributeId), eq(productAttributeOptions.value, data.value))).limit(1);
  if (duplicate) throw new AppError('This option already exists for the attribute.', 409);
  const id = await db.transaction(async (transaction) => {
    const result = await transaction.insert(productAttributeOptions).values({ ...data, attributeId });
    const optionId = Number(result[0].insertId);
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: 'create', entityId: optionId, entityType: 'product_attribute_option', newValues: { ...data, attributeId },
    }));
    return optionId;
  });
  return findOption(id);
};

export const updateAttributeOption = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = entityIdSchema.parse(idInput);
  const data = updateAttributeOptionSchema.parse(input);
  const current = await findOption(id);
  if (data.value && data.value !== current.value) {
    const [duplicate] = await db.select({ id: productAttributeOptions.id }).from(productAttributeOptions)
      .where(and(eq(productAttributeOptions.attributeId, current.attributeId), eq(productAttributeOptions.value, data.value))).limit(1);
    if (duplicate) throw new AppError('This option already exists for the attribute.', 409);
  }
  await db.transaction(async (transaction) => {
    await transaction.update(productAttributeOptions).set(data).where(eq(productAttributeOptions.id, id));
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: 'update', entityId: id, entityType: 'product_attribute_option', newValues: data, oldValues: current,
    }));
  });
  return { ...current, ...data };
};

export const setAttributeOptionStatus = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = entityIdSchema.parse(idInput);
  const { isActive } = updateStatusSchema.parse(input);
  const current = await findOption(id);
  if (isActive) {
    const attribute = await findAttribute(current.attributeId);
    if (!attribute.isActive) throw new AppError('Activate the parent attribute first.', 409);
  }
  if (!isActive) {
    const [mapping] = await db.select({ productId: productProductAttributeOptions.productId })
      .from(productProductAttributeOptions).where(eq(productProductAttributeOptions.optionId, id)).limit(1);
    if (mapping) throw new AppError('This option is used by a product variation and cannot be deactivated.', 409);
  }
  await db.transaction(async (transaction) => {
    await transaction.update(productAttributeOptions).set({ isActive }).where(eq(productAttributeOptions.id, id));
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: isActive ? 'activate' : 'deactivate', entityId: id, entityType: 'product_attribute_option',
      newValues: { isActive }, oldValues: { isActive: current.isActive },
    }));
  });
  return { ...current, isActive };
};
