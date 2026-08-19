import { bigint, boolean, decimal, index, int, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { products } from '../product/product';
import { locations } from '../settings/location';
import { grns } from '../purchasing/grn/grn';
import { purchaseOrders } from '../purchasing/purchaseOrder/purchaseOrder';
import { suppliers } from '../purchasing/supplier/supplier';
import { stockStatuses } from './stockStatus';

export const stock = mysqlTable(
  'stock',
  {
    id: int('id').primaryKey().autoincrement(),
    timestamp: bigint('timestamp', { mode: 'number', unsigned: true }).notNull(),
    latestAvailableDateTime: bigint('latest_available_date_time', { mode: 'number', unsigned: true }).notNull(),
    productId: int('product_id').references(() => products.id),
    code: varchar('code', { length: 255}).notNull(),
    supplierId: int('supplier_id').references(() => suppliers.id),
    locationId: int('location_id').references(() => locations.id),
    gCostPrice: decimal('g_cost_price', { precision: 10, scale: 2 }).notNull(),
    costPrice: decimal('cost_price', { precision: 10, scale: 2 }).notNull(),
    onlinePrice: decimal('online_price', { precision: 10, scale: 2 }),
    maxRetailPrice: decimal('max_retail_price', { precision: 10, scale: 2 }),
    isAllowToSellBelowCost: boolean('is_allow_to_sell_below_cost').default(false),
    purchaseOrderId: int('purchase_order_id').references(() => purchaseOrders.id),
    grnId: int('grn_id').references(() => grns.id),
    status: int('status').references(() => stockStatuses.id),
  },
  (table) => [
    uniqueIndex('stock_code_uq').on(table.code),
    index('stock_product_id_idx').on(table.productId),
    index('stock_supplier_id_idx').on(table.supplierId),
    index('stock_location_id_idx').on(table.locationId),
    index('stock_status_idx').on(table.status),
    index('stock_product_status_location_idx').on(table.productId, table.status, table.locationId),
  ],
);
