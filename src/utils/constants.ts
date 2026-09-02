export const USER_ACCESS = {
  GENERAL_DATA: 'GENERAL_DATA',
  PUBLIC: 'PUBLIC',
} as const;

export const USER_ROLES = {
  ADMIN: 'admin',
  PENDING: 'pending_user',
} as const;

export const TIME_ZONE = 'Asia/Colombo';

export const DOCUMENT_TYPES = {
  GOODS_RECEIVED_NOTE: 'GOODS_RECEIVED_NOTE',
  PURCHASE_ORDER: 'PURCHASE_ORDER',
  PURCHASE_RETURN: 'PURCHASE_RETURN',
  STOCK_BARCODE: 'STOCK_BARCODE',
  SUPPLIER_CODE: 'SUPPLIER_CODE',
  SUPPLIER_INVOICE: 'SUPPLIER_INVOICE',
  SUPPLIER_PAYMENT: 'SUPPLIER_PAYMENT',
} as const;

export const DOCUMENT_SEQUENCE_DEFAULTS = [
  { documentType: DOCUMENT_TYPES.PURCHASE_ORDER, prefix: 'PO' },
  { documentType: DOCUMENT_TYPES.GOODS_RECEIVED_NOTE, prefix: 'GRN' },
  { documentType: DOCUMENT_TYPES.PURCHASE_RETURN, prefix: 'PR' },
  { documentType: DOCUMENT_TYPES.SUPPLIER_INVOICE, prefix: 'SI' },
  { documentType: DOCUMENT_TYPES.SUPPLIER_PAYMENT, prefix: 'SP' },
  { documentType: DOCUMENT_TYPES.STOCK_BARCODE, prefix: 'MB' },
  { documentType: DOCUMENT_TYPES.SUPPLIER_CODE, prefix: 'SUP' },
] as const;

export const PURCHASE_ORDER_STATUS = {
  APPROVED: 'approved',
  CANCELLED: 'cancelled',
  DRAFT: 'draft',
  ORDERED: 'ordered',
  PARTIALLY_RECEIVED: 'partially_received',
  PENDING_APPROVAL: 'pending_approval',
  RECEIVED: 'received',
  REJECTED: 'rejected',
} as const;

export const STOCK_STATUS = {
  AVAILABLE: 'available',
  DAMAGED: 'damaged',
  GRN_DECLINED: 'grn_declined',
  IN_TRANSFER: 'in_transfer',
  MISSING: 'missing',
  PENDING_GRN_APPROVAL: 'pending_grn_approval',
  RESERVED: 'reserved',
  RETURNED_TO_SUPPLIER: 'returned_to_supplier',
  SOLD: 'sold',
  UNDER_REPAIR: 'under_repair',
} as const;

export const USER_PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  DOCUMENT_SEQUENCES_CREATE: 'document_sequences.create',
  DOCUMENT_SEQUENCES_UPDATE: 'document_sequences.update',
  DOCUMENT_SEQUENCES_VIEW: 'document_sequences.view',
  GRNS_COUNT: 'grns.count',
  GRNS_CREATE: 'grns.create',
  GRNS_DOCUMENTS: 'grns.documents',
  GRNS_FINANCE_APPROVE: 'grns.finance_approve',
  GRNS_STOCK_ADD: 'grns.stock_add',
  GRNS_VIEW: 'grns.view',
  LOCATIONS_CREATE: 'locations.create',
  LOCATIONS_UPDATE: 'locations.update',
  LOCATIONS_VIEW: 'locations.view',
  PERMISSIONS_CREATE: 'permissions.create',
  PERMISSIONS_DELETE: 'permissions.delete',
  PERMISSIONS_UPDATE: 'permissions.update',
  PRODUCT_ATTRIBUTES_CREATE: 'product_attributes.create',
  PRODUCT_ATTRIBUTES_UPDATE: 'product_attributes.update',
  PRODUCT_ATTRIBUTES_VIEW: 'product_attributes.view',
  PRODUCT_CATEGORIES_CREATE: 'product_categories.create',
  PRODUCT_CATEGORIES_UPDATE: 'product_categories.update',
  PRODUCT_CATEGORIES_VIEW: 'product_categories.view',
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_UPDATE: 'products.update',
  PRODUCTS_VIEW: 'products.view',
  PURCHASE_ORDERS_APPROVE: 'purchase_orders.approve',
  PURCHASE_ORDERS_CANCEL: 'purchase_orders.cancel',
  PURCHASE_ORDERS_CREATE: 'purchase_orders.create',
  PURCHASE_ORDERS_ORDER: 'purchase_orders.order',
  PURCHASE_ORDERS_SUBMIT: 'purchase_orders.submit',
  PURCHASE_ORDERS_UPDATE: 'purchase_orders.update',
  PURCHASE_ORDERS_VIEW: 'purchase_orders.view',
  SUPPLIERS_CREATE: 'suppliers.create',
  SUPPLIERS_UPDATE: 'suppliers.update',
  SUPPLIERS_VIEW: 'suppliers.view',
  STOCK_VIEW: 'stock.view',
  ROLES_ASSIGN_PERMISSIONS: 'roles.assign_permissions',
  ROLES_CREATE: 'roles.create',
  ROLES_DELETE: 'roles.delete',
  ROLES_UPDATE: 'roles.update',
  ROLES_VIEW: 'roles.view',
  USERS_ASSIGN_ROLES: 'users.assign_roles',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_VIEW: 'users.view',
} as const;

export type UserAccess = (typeof USER_ACCESS)[keyof typeof USER_ACCESS];
export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
export type UserPermission = (typeof USER_PERMISSIONS)[keyof typeof USER_PERMISSIONS];
