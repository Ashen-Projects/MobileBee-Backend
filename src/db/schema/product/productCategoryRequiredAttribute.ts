import { foreignKey, int, mysqlTable, primaryKey } from 'drizzle-orm/mysql-core';

import { productAttributes } from './productAttribute';
import { productCategories } from './productCategory';

export const productCategoryRequiredAttributes = mysqlTable(
  'product_category_required_attributes',
  {
    attributeId: int('attribute_id').notNull(),
    categoryId: int('category_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.categoryId, table.attributeId] }),
    foreignKey({
      columns: [table.categoryId],
      foreignColumns: [productCategories.id],
      name: 'pcra_category_fk',
    }),
    foreignKey({
      columns: [table.attributeId],
      foreignColumns: [productAttributes.id],
      name: 'pcra_attribute_fk',
    }),
  ],
);
