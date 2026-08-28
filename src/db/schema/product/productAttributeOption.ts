import { boolean, index, int, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { productAttributes } from './productAttribute';

export const productAttributeOptions = mysqlTable(
  'product_attribute_options',
  {
    id: int('id').primaryKey().autoincrement(),
    attributeId: int('attribute_id')
      .notNull()
      .references(() => productAttributes.id),
    value: varchar('value', { length: 150 }).notNull(),
    label: varchar('label', { length: 150 }).notNull(),
    description: varchar('description', { length: 1024 }),
    iconUrl: varchar('icon_url', { length: 1024 }),
    colorHex: varchar('color_hex', { length: 7 }),
    priority: int('priority').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    uniqueIndex('product_attribute_options_attribute_value_uq').on(table.attributeId, table.value),
    index('product_attribute_options_attribute_id_idx').on(table.attributeId),
  ],
);
