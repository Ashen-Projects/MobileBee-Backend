import { bigint, index, int, mysqlTable, primaryKey } from 'drizzle-orm/mysql-core';

import { locations } from '../settings/location';
import { users } from '../user/user';
import { products } from './product';

export const productLocationStockLevels = mysqlTable(
  'product_location_stock_levels',
  {
    productId: int('product_id')
      .notNull()
      .references(() => products.id),
    locationId: int('location_id')
      .notNull()
      .references(() => locations.id),
    minimumStockLevel: int('minimum_stock_level', { unsigned: true }).notNull().default(0),
    updatedAt: bigint('updated_at', { mode: 'number', unsigned: true }).notNull(),
    updatedBy: int('updated_by')
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.locationId] }),
    index('product_location_stock_levels_location_id_idx').on(table.locationId),
  ],
);
