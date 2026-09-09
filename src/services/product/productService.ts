import { and, asc, count, desc, eq, inArray, isNull, like, ne, or } from 'drizzle-orm';

import { db } from '../../db';
import {
  auditLogs,
  productAttributeOptions,
  productAttributes,
  productCategories,
  productCategoryRequiredAttributes,
  productImages,
  productLocationStockLevels,
  productProductAttributeOptions,
  products,
  seo,
  locations,
} from '../../db/schema';
import { AppError } from '../../errors/app-error';
import type { AuthenticatedUser } from '../auth/authService';
import {
  createProductSchema,
  entityIdSchema,
  listProductsSchema,
  updateProductSchema,
  updateStatusSchema,
} from './productValidation';

type AuditContext = { ipAddress?: string };
type ProductRow = typeof products.$inferSelect;

const audit = (user: AuthenticatedUser, context: AuditContext, values: {
  action: string;
  entityId: number;
  newValues?: unknown;
  oldValues?: unknown;
}) => ({
  ...values,
  entityType: 'product',
  ipAddress: context.ipAddress,
  module: 'products',
  timestamp: Date.now(),
  userId: user.id,
});

const findProduct = async (id: number): Promise<ProductRow> => {
  const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!row) throw new AppError('Product not found.', 404);
  return row;
};

const assertActiveStockLocations = async (levels: Array<{ locationId: number; minimumStockLevel: number }>) => {
  if (!levels.length) return;
  const locationRows = await db.select({ id: locations.id, isActive: locations.isActive }).from(locations)
    .where(inArray(locations.id, levels.map(({ locationId }) => locationId)));
  if (locationRows.length !== levels.length || locationRows.some(({ isActive }) => !isActive)) {
    throw new AppError('Every stock alert location must exist and be active.', 400);
  }
};

const assertUniqueProduct = async (name: string, sku: string | null, excludedId?: number) => {
  const conditions = [eq(products.name, name)];
  if (sku) conditions.push(eq(products.sku, sku));
  const duplicateWhere = or(...conditions);
  const [duplicate] = await db.select({ id: products.id, name: products.name, sku: products.sku }).from(products)
    .where(excludedId ? and(ne(products.id, excludedId), duplicateWhere) : duplicateWhere).limit(1);
  if (!duplicate) return;
  if (duplicate.name === name) throw new AppError('A product with this name already exists.', 409);
  throw new AppError('A product with this SKU already exists.', 409);
};

const assertActiveCategory = async (categoryId: number) => {
  const [category] = await db.select().from(productCategories)
    .where(eq(productCategories.id, categoryId)).limit(1);
  if (!category) throw new AppError('Product category not found.', 400);
  if (!category.isActive) throw new AppError('The selected product category is inactive.', 400);
  return category;
};

const getValidatedOptions = async (optionIds: number[]) => {
  if (!optionIds.length) return [];
  const rows = await db.select({
    attributeId: productAttributeOptions.attributeId,
    attributeIsActive: productAttributes.isActive,
    attributeName: productAttributes.displayName,
    id: productAttributeOptions.id,
    isActive: productAttributeOptions.isActive,
  }).from(productAttributeOptions)
    .innerJoin(productAttributes, eq(productAttributeOptions.attributeId, productAttributes.id))
    .where(inArray(productAttributeOptions.id, optionIds));
  if (rows.length !== optionIds.length) throw new AppError('One or more product attribute options do not exist.', 400);
  if (rows.some(({ attributeIsActive, isActive }) => !attributeIsActive || !isActive)) {
    throw new AppError('One or more product attribute options are inactive.', 400);
  }
  const attributeIds = rows.map(({ attributeId }) => attributeId);
  if (new Set(attributeIds).size !== attributeIds.length) {
    throw new AppError('A variation can use only one option from each attribute.', 400);
  }
  return rows;
};

const getRequiredAttributeIds = async (categoryId: number) => {
  const [categories, mappings] = await Promise.all([
    db.select({ id: productCategories.id, parentId: productCategories.parentId }).from(productCategories),
    db.select().from(productCategoryRequiredAttributes),
  ]);
  const ids = new Set<number>();
  const visited = new Set<number>();
  let currentId: number | null = categoryId;
  while (currentId !== null) {
    if (visited.has(currentId)) throw new AppError('The product category hierarchy contains a cycle.', 409);
    visited.add(currentId);
    mappings.filter(({ categoryId: mappedCategoryId }) => mappedCategoryId === currentId)
      .forEach(({ attributeId }) => ids.add(attributeId));
    currentId = categories.find(({ id }) => id === currentId)?.parentId ?? null;
  }
  return [...ids];
};

const assertRequiredOptions = async (categoryId: number, optionIds: number[], isVariableParent: boolean) => {
  if (isVariableParent) return;
  const [requiredIds, options] = await Promise.all([
    getRequiredAttributeIds(categoryId),
    getValidatedOptions(optionIds),
  ]);
  const selectedAttributeIds = new Set(options.map(({ attributeId }) => attributeId));
  const missing = requiredIds.filter((id) => !selectedAttributeIds.has(id));
  if (missing.length) throw new AppError(`All attributes required by the product category must be selected. Missing attribute IDs: ${missing.join(', ')}.`, 400);
};

const assertUniqueVariationCombination = async (parentId: number, optionIds: number[], excludedId?: number) => {
  const siblings = await db.select({ id: products.id }).from(products).where(eq(products.parentId, parentId));
  const siblingIds = siblings.map(({ id }) => id).filter((id) => id !== excludedId);
  if (!siblingIds.length) return;
  const mappings = await db.select().from(productProductAttributeOptions)
    .where(inArray(productProductAttributeOptions.productId, siblingIds));
  const target = [...optionIds].sort((a, b) => a - b).join(',');
  for (const siblingId of siblingIds) {
    const current = mappings.filter(({ productId }) => productId === siblingId)
      .map(({ optionId }) => optionId).sort((a, b) => a - b).join(',');
    if (current === target) throw new AppError('A variation with this attribute combination already exists.', 409);
  }
};

const resolveProductStructure = async (data: {
  categoryId?: number | null;
  hasVariations: boolean;
  optionIds: number[];
  parentId?: number | null;
}, excludedId?: number) => {
  let categoryId = data.categoryId ?? null;
  let parent: ProductRow | null = null;
  if (data.parentId) {
    parent = await findProduct(data.parentId);
    if (!parent.isActive) throw new AppError('The parent product is inactive.', 400);
    if (!parent.hasVariations || parent.parentId) throw new AppError('The selected parent is not a variable product.', 400);
    categoryId = parent.categoryId;
    await assertRequiredOptions(categoryId ?? 0, data.optionIds, false);
    await assertUniqueVariationCombination(parent.id, data.optionIds, excludedId);
  } else {
    if (!categoryId) throw new AppError('A category is required for a product.', 400);
    if (data.hasVariations && data.optionIds.length) throw new AppError('A variable parent product cannot have attribute options.', 400);
  }
  if (!categoryId) throw new AppError('The parent product must have a category.', 409);
  await assertActiveCategory(categoryId);
  await assertRequiredOptions(categoryId, data.optionIds, !data.parentId && data.hasVariations);
  return { categoryId, parent };
};

const getOptionDetails = async (productIds: number[]) => {
  if (!productIds.length) return [];
  return db.select({
    attributeDisplayName: productAttributes.displayName,
    attributeId: productAttributes.id,
    attributeName: productAttributes.name,
    colorHex: productAttributeOptions.colorHex,
    label: productAttributeOptions.label,
    optionId: productAttributeOptions.id,
    productId: productProductAttributeOptions.productId,
    value: productAttributeOptions.value,
  }).from(productProductAttributeOptions)
    .innerJoin(productAttributeOptions, eq(productProductAttributeOptions.optionId, productAttributeOptions.id))
    .innerJoin(productAttributes, eq(productAttributeOptions.attributeId, productAttributes.id))
    .where(inArray(productProductAttributeOptions.productId, productIds))
    .orderBy(asc(productAttributes.priority), asc(productAttributeOptions.priority));
};

export const listProducts = async (input: unknown) => {
  const query = listProductsSchema.parse(input);
  const filters = [];
  if (query.categoryId) filters.push(eq(products.categoryId, query.categoryId));
  if (query.parentId) filters.push(eq(products.parentId, query.parentId));
  if (query.rootOnly) filters.push(isNull(products.parentId));
  if (query.hasVariations !== undefined) filters.push(eq(products.hasVariations, query.hasVariations));
  if (query.isActive !== 'all') filters.push(eq(products.isActive, query.isActive === 'true'));
  if (query.search) filters.push(or(
    like(products.name, `%${query.search}%`),
    like(products.sku, `%${query.search}%`),
  ));
  const where = filters.length ? and(...filters) : undefined;
  const offset = (query.page - 1) * query.pageSize;
  const [rows, [{ total }]] = await Promise.all([
    db.select({
      categoryId: productCategories.id,
      categoryName: productCategories.name,
      hasVariations: products.hasVariations,
      id: products.id,
      isActive: products.isActive,
      isAvailableOnWeb: products.isAvailableOnWeb,
      lowestSellingPrice: products.lowestSellingPrice,
      maxPurchasingPrice: products.maxPurchasingPrice,
      mrpPrice: products.mrpPrice,
      name: products.name,
      parentId: products.parentId,
      priority: products.priority,
      sku: products.sku,
    }).from(products).leftJoin(productCategories, eq(products.categoryId, productCategories.id))
      .where(where).orderBy(desc(products.id)).limit(query.pageSize).offset(offset),
    db.select({ total: count() }).from(products).where(where),
  ]);
  const childRows = rows.length
    ? await db.select({ parentId: products.parentId }).from(products)
      .where(inArray(products.parentId, rows.map(({ id }) => id)))
    : [];
  const parentIdsWithChildren = new Set(childRows.flatMap(({ parentId }) => parentId ? [parentId] : []));
  const variationCountByParent = childRows.reduce((counts, { parentId }) => {
    if (parentId) counts.set(parentId, (counts.get(parentId) ?? 0) + 1);
    return counts;
  }, new Map<number, number>());
  return {
    items: rows.map(({ categoryId, categoryName, ...product }) => ({
      ...product,
      hasVariations: product.hasVariations || parentIdsWithChildren.has(product.id),
      variationCount: variationCountByParent.get(product.id) ?? 0,
      category: categoryId ? { id: categoryId, name: categoryName } : null,
    })),
    pagination: { page: query.page, pageSize: query.pageSize, total: Number(total), totalPages: Math.ceil(Number(total) / query.pageSize) },
  };
};

export const getProduct = async (idInput: unknown) => {
  const id = entityIdSchema.parse(idInput);
  const product = await findProduct(id);
  const variations = await db.select().from(products).where(eq(products.parentId, id))
    .orderBy(asc(products.priority), asc(products.name));
  const productIds = [id, ...variations.map(({ id: variationId }) => variationId)];
  const [category, imageRows, seoRows, optionRows, stockLevelRows] = await Promise.all([
    product.categoryId ? db.select().from(productCategories).where(eq(productCategories.id, product.categoryId)).limit(1) : [],
    db.select().from(productImages).where(inArray(productImages.productId, productIds))
      .orderBy(desc(productImages.isPrimary), asc(productImages.priority), asc(productImages.id)),
    product.seoId ? db.select().from(seo).where(eq(seo.seoId, product.seoId)).limit(1) : [],
    getOptionDetails(productIds),
    db.select({
      locationId: locations.id,
      locationName: locations.name,
      minimumStockLevel: productLocationStockLevels.minimumStockLevel,
    }).from(locations)
      .leftJoin(productLocationStockLevels, and(
        eq(productLocationStockLevels.locationId, locations.id),
        eq(productLocationStockLevels.productId, id),
      ))
      .where(eq(locations.isActive, true)).orderBy(asc(locations.name)),
  ]);
  const decorate = (row: ProductRow) => ({
    ...row,
    images: imageRows.filter(({ productId }) => productId === row.id),
    options: optionRows.filter(({ productId }) => productId === row.id),
  });
  return {
    ...decorate(product),
    hasVariations: product.hasVariations || variations.length > 0,
    category: category[0] ?? null,
    seo: seoRows[0] ?? null,
    stockLevels: stockLevelRows.map((row) => ({
      locationId: row.locationId,
      locationName: row.locationName,
      minimumStockLevel: Number(row.minimumStockLevel ?? 0),
    })),
    variations: variations.map(decorate),
  };
};

export const listStockLevelLocations = async () => db.select({
  locationId: locations.id,
  locationName: locations.name,
}).from(locations).where(eq(locations.isActive, true)).orderBy(asc(locations.name))
  .then((rows) => rows.map(({ locationId, locationName }) => ({ locationId, locationName, minimumStockLevel: 0 })));

export const createProduct = async (input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const data = createProductSchema.parse(input);
  await assertActiveStockLocations(data.stockLevels);
  const { categoryId } = await resolveProductStructure(data);
  await assertUniqueProduct(data.name, data.sku ?? null);
  const id = await db.transaction(async (transaction) => {
    let seoId: number | null = null;
    if (data.seo) {
      const result = await transaction.insert(seo).values(data.seo);
      seoId = Number(result[0].insertId);
    }
    const result = await transaction.insert(products).values({
      categoryId,
      description: data.description ?? null,
      hasVariations: data.hasVariations,
      iconUrl: data.iconUrl ?? null,
      isActive: data.isActive,
      isAvailableOnWeb: data.isAvailableOnWeb,
      logoUrl: data.logoUrl ?? null,
      lowestSellingPrice: data.hasVariations && !data.parentId ? '0.00' : data.lowestSellingPrice,
      maxPurchasingPrice: data.hasVariations && !data.parentId ? '0.00' : data.maxPurchasingPrice,
      mrpPrice: data.hasVariations && !data.parentId ? '0.00' : data.mrpPrice,
      name: data.name,
      parentId: data.parentId ?? null,
      priority: data.priority,
      seoId,
      shortDescription: data.shortDescription ?? null,
      sku: data.sku ?? null,
    });
    const productId = Number(result[0].insertId);
    if (data.parentId) {
      await transaction.update(products).set({ hasVariations: true }).where(eq(products.id, data.parentId));
    }
    if (data.optionIds.length) {
      await transaction.insert(productProductAttributeOptions).values(data.optionIds.map((optionId) => ({
        optionId, productId, timestamp: Date.now(),
      })));
    }
    if (data.images.length) {
      await transaction.insert(productImages).values(data.images.map((image) => ({
        ...image, altText: image.altText ?? null, productId, timestamp: Date.now(),
      })));
    }
    if (!data.hasVariations && data.stockLevels.length) {
      await transaction.insert(productLocationStockLevels).values(data.stockLevels.map((level) => ({
        ...level,
        productId,
        updatedAt: Date.now(),
        updatedBy: user.id,
      })));
    }
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: 'create', entityId: productId, newValues: { ...data, categoryId, seoId },
    }));
    return productId;
  });
  return getProduct(id);
};

export const updateProduct = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = entityIdSchema.parse(idInput);
  const data = updateProductSchema.parse(input);
  if (data.stockLevels) await assertActiveStockLocations(data.stockLevels);
  const current = await findProduct(id);
  const optionIds = data.optionIds ?? (await db.select({ optionId: productProductAttributeOptions.optionId })
    .from(productProductAttributeOptions).where(eq(productProductAttributeOptions.productId, id))).map(({ optionId }) => optionId);
  const categoryIdInput = data.categoryId === undefined ? current.categoryId : data.categoryId;
  const { categoryId } = await resolveProductStructure({
    categoryId: categoryIdInput,
    hasVariations: current.hasVariations,
    optionIds,
    parentId: current.parentId,
  }, id);
  const nextName = data.name ?? current.name;
  const nextSku = data.sku === undefined ? current.sku : data.sku;
  await assertUniqueProduct(nextName, nextSku, id);
  const nextLowest = data.lowestSellingPrice ?? current.lowestSellingPrice;
  const nextMrp = data.mrpPrice ?? current.mrpPrice;
  if (!current.hasVariations && Number(nextLowest) > 0 && Number(nextMrp) > 0 && Number(nextLowest) > Number(nextMrp)) {
    throw new AppError('Lowest selling price cannot exceed MRP.', 400);
  }

  await db.transaction(async (transaction) => {
    let seoId = current.seoId;
    if (data.seo === null && seoId) {
      await transaction.update(products).set({ seoId: null }).where(eq(products.id, id));
      await transaction.delete(seo).where(eq(seo.seoId, seoId));
      seoId = null;
    } else if (data.seo) {
      if (seoId) await transaction.update(seo).set(data.seo).where(eq(seo.seoId, seoId));
      else {
        const result = await transaction.insert(seo).values(data.seo);
        seoId = Number(result[0].insertId);
      }
    }
    const updateValues = {
      categoryId,
      description: data.description === undefined ? current.description : data.description,
      iconUrl: data.iconUrl === undefined ? current.iconUrl : data.iconUrl,
      isAvailableOnWeb: data.isAvailableOnWeb ?? current.isAvailableOnWeb,
      logoUrl: data.logoUrl === undefined ? current.logoUrl : data.logoUrl,
      lowestSellingPrice: current.hasVariations ? '0.00' : nextLowest,
      maxPurchasingPrice: current.hasVariations ? '0.00' : data.maxPurchasingPrice ?? current.maxPurchasingPrice,
      mrpPrice: current.hasVariations ? '0.00' : nextMrp,
      name: nextName,
      priority: data.priority ?? current.priority,
      seoId,
      shortDescription: data.shortDescription === undefined ? current.shortDescription : data.shortDescription,
      sku: nextSku,
    };
    await transaction.update(products).set(updateValues).where(eq(products.id, id));
    if (current.hasVariations && categoryId !== current.categoryId) {
      await transaction.update(products).set({ categoryId }).where(eq(products.parentId, id));
    }
    if (data.optionIds) {
      if (!current.parentId && current.hasVariations && data.optionIds.length) throw new AppError('A variable parent product cannot have attribute options.', 400);
      await transaction.delete(productProductAttributeOptions).where(eq(productProductAttributeOptions.productId, id));
      if (data.optionIds.length) await transaction.insert(productProductAttributeOptions).values(data.optionIds.map((optionId) => ({
        optionId, productId: id, timestamp: Date.now(),
      })));
    }
    if (data.stockLevels) {
      if (current.hasVariations && !current.parentId) {
        throw new AppError('Stock alert levels must be configured on sellable variations, not the parent product.', 400);
      }
      await transaction.delete(productLocationStockLevels).where(eq(productLocationStockLevels.productId, id));
      if (data.stockLevels.length) {
        await transaction.insert(productLocationStockLevels).values(data.stockLevels.map((level) => ({
          ...level,
          productId: id,
          updatedAt: Date.now(),
          updatedBy: user.id,
        })));
      }
    }
    if (data.images) {
      await transaction.delete(productImages).where(eq(productImages.productId, id));
      if (data.images.length) await transaction.insert(productImages).values(data.images.map((image) => ({
        ...image, altText: image.altText ?? null, productId: id, timestamp: Date.now(),
      })));
    }
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: 'update', entityId: id, newValues: { ...data, categoryId, seoId }, oldValues: current,
    }));
  });
  return getProduct(id);
};

export const setProductStatus = async (idInput: unknown, input: unknown, user: AuthenticatedUser, context: AuditContext = {}) => {
  const id = entityIdSchema.parse(idInput);
  const { isActive } = updateStatusSchema.parse(input);
  const current = await findProduct(id);
  if (isActive) {
    if (current.categoryId) await assertActiveCategory(current.categoryId);
    if (current.parentId) {
      const parent = await findProduct(current.parentId);
      if (!parent.isActive) throw new AppError('Activate the parent product first.', 409);
    }
  }
  await db.transaction(async (transaction) => {
    await transaction.update(products).set({ isActive }).where(eq(products.id, id));
    if (current.hasVariations && !isActive) {
      await transaction.update(products).set({ isActive: false }).where(eq(products.parentId, id));
    }
    await transaction.insert(auditLogs).values(audit(user, context, {
      action: isActive ? 'activate' : 'deactivate', entityId: id,
      newValues: { isActive }, oldValues: { isActive: current.isActive },
    }));
  });
  return getProduct(id);
};
