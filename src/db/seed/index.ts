import { eq } from 'drizzle-orm';

import { db } from '..';
import { env } from '../../env';
import { firebaseAuth } from '../../services/auth/firebaseService';
import {
  documentSequences,
  locations,
  permissions,
  purchaseOrderStatuses,
  rolePermissions,
  roles,
  stockStatuses,
  userRoles,
  users,
} from '../schema';
import {
  DOCUMENT_SEQUENCE_DEFAULTS,
  PURCHASE_ORDER_STATUS,
  STOCK_STATUS,
  TIME_ZONE,
  USER_ACCESS,
  USER_PERMISSIONS,
  USER_ROLES,
} from '../../utils/constants';

const getOrCreateFirebaseAdministrator = async () => {
  try {
    return await firebaseAuth.getUserByEmail(env.BOOTSTRAP_ADMIN_EMAIL);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== 'auth/user-not-found') throw error;

    return firebaseAuth.createUser({
      displayName: 'Mobee Administrator',
      email: env.BOOTSTRAP_ADMIN_EMAIL,
      emailVerified: true,
      password: env.BOOTSTRAP_ADMIN_PASSWORD,
    });
  }
};

export const seedDatabase = async (): Promise<void> => {
  const timestamp = Date.now();

  await db.insert(locations).values({
    code: 'HEAD_OFFICE',
    isActive: true,
    name: 'Head Office',
    timestamp,
    type: 'shop',
  }).onDuplicateKeyUpdate({ set: { isActive: true, name: 'Head Office' } });

  const [headOffice] = await db.select({ id: locations.id }).from(locations)
    .where(eq(locations.code, 'HEAD_OFFICE')).limit(1);
  if (!headOffice) throw new Error('Failed to seed the Head Office location.');

  const purchaseOrderStatusSeeds = [
    { isFinal: false, label: 'Draft', name: PURCHASE_ORDER_STATUS.DRAFT, priority: 10 },
    { isFinal: false, label: 'Pending Approval', name: PURCHASE_ORDER_STATUS.PENDING_APPROVAL, priority: 20 },
    { isFinal: false, label: 'Approved', name: PURCHASE_ORDER_STATUS.APPROVED, priority: 30 },
    { isFinal: false, label: 'Ordered', name: PURCHASE_ORDER_STATUS.ORDERED, priority: 40 },
    { isFinal: false, label: 'Partially Received', name: PURCHASE_ORDER_STATUS.PARTIALLY_RECEIVED, priority: 50 },
    { isFinal: true, label: 'Received', name: PURCHASE_ORDER_STATUS.RECEIVED, priority: 60 },
    { isFinal: true, label: 'Cancelled', name: PURCHASE_ORDER_STATUS.CANCELLED, priority: 70 },
    { isFinal: true, label: 'Rejected', name: PURCHASE_ORDER_STATUS.REJECTED, priority: 80 },
  ];
  for (const status of purchaseOrderStatusSeeds) {
    await db.insert(purchaseOrderStatuses).values(status).onDuplicateKeyUpdate({
      set: { isFinal: status.isFinal, label: status.label, priority: status.priority },
    });
  }

  const stockStatusSeeds = [
    { isActive: true, isSellable: true, label: 'Available', name: STOCK_STATUS.AVAILABLE },
    { isActive: true, isSellable: false, label: 'Pending GRN Approval', name: STOCK_STATUS.PENDING_GRN_APPROVAL },
    { isActive: true, isSellable: false, label: 'GRN Declined', name: STOCK_STATUS.GRN_DECLINED },
    { isActive: true, isSellable: false, label: 'Reserved', name: STOCK_STATUS.RESERVED },
    { isActive: true, isSellable: false, label: 'Sold', name: STOCK_STATUS.SOLD },
    { isActive: true, isSellable: false, label: 'Damaged', name: STOCK_STATUS.DAMAGED },
    { isActive: true, isSellable: false, label: 'In Transfer', name: STOCK_STATUS.IN_TRANSFER },
    { isActive: true, isSellable: false, label: 'Under Repair', name: STOCK_STATUS.UNDER_REPAIR },
    { isActive: true, isSellable: false, label: 'Returned to Supplier', name: STOCK_STATUS.RETURNED_TO_SUPPLIER },
    { isActive: true, isSellable: false, label: 'Missing', name: STOCK_STATUS.MISSING },
  ];
  for (const status of stockStatusSeeds) {
    await db.insert(stockStatuses).values(status).onDuplicateKeyUpdate({
      set: { isActive: status.isActive, isSellable: status.isSellable, label: status.label },
    });
  }

  const currentYear = Number(new Intl.DateTimeFormat('en', { timeZone: TIME_ZONE, year: 'numeric' }).format(new Date()));
  for (const sequence of DOCUMENT_SEQUENCE_DEFAULTS) {
    await db.insert(documentSequences).values({
      ...sequence,
      lastNumber: 0,
      locationId: headOffice.id,
      year: currentYear,
    }).onDuplicateKeyUpdate({ set: { prefix: sequence.prefix } });
  }

  await db.insert(roles).values({
    description: 'System administrator with unrestricted access.',
    isSystem: true,
    label: 'Administrator',
    name: USER_ROLES.ADMIN,
  }).onDuplicateKeyUpdate({ set: { isSystem: true, label: 'Administrator' } });

  await db.insert(roles).values({
    description: 'Default role for users waiting for an administrator to assign access.',
    isSystem: true,
    label: 'Pending User',
    name: USER_ROLES.PENDING,
  }).onDuplicateKeyUpdate({
    set: { description: 'Default role for users waiting for an administrator to assign access.', isSystem: true, label: 'Pending User' },
  });
  const [pendingRole] = await db.select({ id: roles.id }).from(roles)
    .where(eq(roles.name, USER_ROLES.PENDING)).limit(1);
  if (!pendingRole) throw new Error('Failed to seed the Pending User role.');
  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, pendingRole.id));

  const [legacyAllowAllPermission] = await db.select({ id: permissions.id }).from(permissions)
    .where(eq(permissions.key, 'SUPER_ADMIN')).limit(1);
  if (legacyAllowAllPermission) {
    await db.transaction(async (transaction) => {
      await transaction.delete(rolePermissions).where(eq(rolePermissions.permissionId, legacyAllowAllPermission.id));
      await transaction.delete(permissions).where(eq(permissions.id, legacyAllowAllPermission.id));
    });
  }

  const permissionMainCategory = (module: string): string => {
    if (module === 'system') return 'System';
    if (['permissions', 'roles', 'users'].includes(module)) return 'User Management';
    if (['sales'].includes(module)) return 'Point of Sale';
    if (['product_attributes', 'product_categories', 'products'].includes(module)) return 'Products';
    if (['grns', 'purchase_orders', 'suppliers'].includes(module)) return 'Purchasing';
    if (module === 'stock') return 'Inventory';
    if (['document_sequences', 'locations'].includes(module)) return 'Settings';
    return 'Dashboard';
  };

  const permissionSeeds = [
    {
      description: 'View the Mobee dashboard.',
      key: USER_PERMISSIONS.DASHBOARD_VIEW,
      module: 'dashboard',
    },
    {
      description: 'View official dashboard targets and insight thresholds.',
      key: USER_PERMISSIONS.DASHBOARD_CONTROLS_VIEW,
      module: 'dashboard',
    },
    {
      description: 'Set official dashboard targets and insight thresholds. Grant only to trusted management roles.',
      key: USER_PERMISSIONS.DASHBOARD_CONTROLS_UPDATE,
      module: 'dashboard',
    },
    {
      description: 'Resolve or dismiss dashboard insights with an auditable note.',
      key: USER_PERMISSIONS.DASHBOARD_INSIGHTS_ACTION,
      module: 'dashboard',
    },
    {
      description: 'View assigned-location sales KPIs, trends, payment mix, discounts, and top products on the dashboard.',
      key: USER_PERMISSIONS.DASHBOARD_SALES_VIEW,
      module: 'dashboard',
    },
    {
      description: 'View detailed sales forecasts, forecast accuracy, demand patterns, and planning recommendations. Grant only to management roles.',
      key: USER_PERMISSIONS.DASHBOARD_FORECAST_VIEW,
      module: 'dashboard',
    },
    {
      description: 'View assigned-location stock availability and stock attention indicators on the dashboard.',
      key: USER_PERMISSIONS.DASHBOARD_INVENTORY_VIEW,
      module: 'dashboard',
    },
    {
      description: 'View assigned-location repair workload and stage indicators on the dashboard.',
      key: USER_PERMISSIONS.DASHBOARD_REPAIRS_VIEW,
      module: 'dashboard',
    },
    {
      description: 'View assigned-location purchasing and GRN workflow indicators on the dashboard.',
      key: USER_PERMISSIONS.DASHBOARD_PURCHASING_VIEW,
      module: 'dashboard',
    },
    {
      description: 'View gross profit and cost-of-goods values on the dashboard. Grant only to trusted financial roles.',
      key: USER_PERMISSIONS.DASHBOARD_PROFIT_VIEW,
      module: 'dashboard',
    },
    {
      description: 'View stock cost, stock retail value, purchase cost, paid purchasing totals, and supplier balances on the dashboard.',
      key: USER_PERMISSIONS.DASHBOARD_COST_VIEW,
      module: 'dashboard',
    },
    {
      description: 'View dashboard metrics across all active business locations and use the dashboard location filter.',
      key: USER_PERMISSIONS.DASHBOARD_ALL_LOCATIONS_VIEW,
      module: 'dashboard',
    },
    {
      description: 'View business locations.',
      key: USER_PERMISSIONS.LOCATIONS_VIEW,
      module: 'locations',
    },
    {
      description: 'Create business locations.',
      key: USER_PERMISSIONS.LOCATIONS_CREATE,
      module: 'locations',
    },
    {
      description: 'Update and activate or deactivate business locations.',
      key: USER_PERMISSIONS.LOCATIONS_UPDATE,
      module: 'locations',
    },
    {
      description: 'View customer profiles and contact information.',
      key: USER_PERMISSIONS.CUSTOMERS_VIEW,
      module: 'customers',
    },
    {
      description: 'Create customer profiles.',
      key: USER_PERMISSIONS.CUSTOMERS_CREATE,
      module: 'customers',
    },
    {
      description: 'Update customer profiles and active status.',
      key: USER_PERMISSIONS.CUSTOMERS_UPDATE,
      module: 'customers',
    },
    {
      description: 'View document numbering sequences.',
      key: USER_PERMISSIONS.DOCUMENT_SEQUENCES_VIEW,
      module: 'document_sequences',
    },
    {
      description: 'Create document numbering sequences.',
      key: USER_PERMISSIONS.DOCUMENT_SEQUENCES_CREATE,
      module: 'document_sequences',
    },
    {
      description: 'Update document sequence prefixes without changing issued counters.',
      key: USER_PERMISSIONS.DOCUMENT_SEQUENCES_UPDATE,
      module: 'document_sequences',
    },
    {
      description: 'Access to general authenticated Mobee data.',
      key: USER_ACCESS.GENERAL_DATA,
      module: 'system',
    },
    {
      description: 'Create new backend permission catalog entries.',
      key: USER_PERMISSIONS.PERMISSIONS_CREATE,
      module: 'permissions',
    },
    {
      description: 'Update custom backend permission catalog entries.',
      key: USER_PERMISSIONS.PERMISSIONS_UPDATE,
      module: 'permissions',
    },
    {
      description: 'Delete custom backend permission catalog entries.',
      key: USER_PERMISSIONS.PERMISSIONS_DELETE,
      module: 'permissions',
    },
    {
      description: 'View product categories.',
      key: USER_PERMISSIONS.PRODUCT_CATEGORIES_VIEW,
      module: 'product_categories',
    },
    {
      description: 'Create product categories.',
      key: USER_PERMISSIONS.PRODUCT_CATEGORIES_CREATE,
      module: 'product_categories',
    },
    {
      description: 'Update and activate or deactivate product categories.',
      key: USER_PERMISSIONS.PRODUCT_CATEGORIES_UPDATE,
      module: 'product_categories',
    },
    {
      description: 'View product attributes and options.',
      key: USER_PERMISSIONS.PRODUCT_ATTRIBUTES_VIEW,
      module: 'product_attributes',
    },
    {
      description: 'Create product attributes and options.',
      key: USER_PERMISSIONS.PRODUCT_ATTRIBUTES_CREATE,
      module: 'product_attributes',
    },
    {
      description: 'Update and activate or deactivate product attributes and options.',
      key: USER_PERMISSIONS.PRODUCT_ATTRIBUTES_UPDATE,
      module: 'product_attributes',
    },
    {
      description: 'View the product catalog and variations.',
      key: USER_PERMISSIONS.PRODUCTS_VIEW,
      module: 'products',
    },
    {
      description: 'Create simple products, variable products, and variations.',
      key: USER_PERMISSIONS.PRODUCTS_CREATE,
      module: 'products',
    },
    {
      description: 'Update and activate or deactivate products and variations.',
      key: USER_PERMISSIONS.PRODUCTS_UPDATE,
      module: 'products',
    },
    {
      description: 'View completed customer sales, payments, stock allocations, and invoices.',
      key: USER_PERMISSIONS.SALES_VIEW,
      module: 'sales',
    },
    {
      description: 'Create customer sales, allocate available stock, accept payment, and issue invoices.',
      key: USER_PERMISSIONS.SALES_CREATE,
      module: 'sales',
    },
    {
      description: 'View customer repair jobs, current stage, device details, and repair history.',
      key: USER_PERMISSIONS.REPAIRS_VIEW,
      module: 'repairs',
    },
    {
      description: 'Create repair jobs and issue customer repair receipts.',
      key: USER_PERMISSIONS.REPAIRS_CREATE,
      module: 'repairs',
    },
    {
      description: 'Update repair job stages and repair progress history.',
      key: USER_PERMISSIONS.REPAIRS_UPDATE,
      module: 'repairs',
    },
    {
      description: 'View purchase orders and their workflow history.',
      key: USER_PERMISSIONS.PURCHASE_ORDERS_VIEW,
      module: 'purchase_orders',
    },
    {
      description: 'Create draft purchase orders.',
      key: USER_PERMISSIONS.PURCHASE_ORDERS_CREATE,
      module: 'purchase_orders',
    },
    {
      description: 'Update draft purchase orders and their items.',
      key: USER_PERMISSIONS.PURCHASE_ORDERS_UPDATE,
      module: 'purchase_orders',
    },
    {
      description: 'Submit draft purchase orders for approval.',
      key: USER_PERMISSIONS.PURCHASE_ORDERS_SUBMIT,
      module: 'purchase_orders',
    },
    {
      description: 'Approve or reject submitted purchase orders.',
      key: USER_PERMISSIONS.PURCHASE_ORDERS_APPROVE,
      module: 'purchase_orders',
    },
    {
      description: 'Mark approved purchase orders as ordered.',
      key: USER_PERMISSIONS.PURCHASE_ORDERS_ORDER,
      module: 'purchase_orders',
    },
    {
      description: 'Cancel eligible purchase orders.',
      key: USER_PERMISSIONS.PURCHASE_ORDERS_CANCEL,
      module: 'purchase_orders',
    },
    {
      description: 'View goods received notes, received units, counts, documents, and history.',
      key: USER_PERMISSIONS.GRNS_VIEW,
      module: 'grns',
    },
    {
      description: 'Create goods received notes against ordered purchase orders.',
      key: USER_PERMISSIONS.GRNS_CREATE,
      module: 'grns',
    },
    {
      description: 'Perform one physical GRN quantity count. A different user must complete the second count unless an administrator performs both.',
      key: USER_PERMISSIONS.GRNS_COUNT,
      module: 'grns',
    },
    {
      description: 'Approve or decline GRNs after both independent physical quantity counts.',
      key: USER_PERMISSIONS.GRNS_FINANCE_APPROVE,
      module: 'grns',
    },
    {
      description: 'Assign barcodes, IMEIs, or serial numbers and add finance-approved GRN units to stock.',
      key: USER_PERMISSIONS.GRNS_STOCK_ADD,
      module: 'grns',
    },
    {
      description: 'Attach documents and audit notes to goods received notes.',
      key: USER_PERMISSIONS.GRNS_DOCUMENTS,
      module: 'grns',
    },
    {
      description: 'View suppliers and their linked products.',
      key: USER_PERMISSIONS.SUPPLIERS_VIEW,
      module: 'suppliers',
    },
    {
      description: 'Create suppliers and supplier product links.',
      key: USER_PERMISSIONS.SUPPLIERS_CREATE,
      module: 'suppliers',
    },
    {
      description: 'Update suppliers, status, commercial terms, and linked products.',
      key: USER_PERMISSIONS.SUPPLIERS_UPDATE,
      module: 'suppliers',
    },
    {
      description: 'View stock overview, individual stock units, identifiers, locations, and receipt sources.',
      key: USER_PERMISSIONS.STOCK_VIEW,
      module: 'stock',
    },
    {
      description: 'View the Mobee role and permission catalog.',
      key: USER_PERMISSIONS.ROLES_VIEW,
      module: 'roles',
    },
    {
      description: 'Create Mobee roles.',
      key: USER_PERMISSIONS.ROLES_CREATE,
      module: 'roles',
    },
    {
      description: 'Update Mobee roles.',
      key: USER_PERMISSIONS.ROLES_UPDATE,
      module: 'roles',
    },
    {
      description: 'Delete unused custom Mobee roles.',
      key: USER_PERMISSIONS.ROLES_DELETE,
      module: 'roles',
    },
    {
      description: 'Assign multiple permissions to a Mobee role.',
      key: USER_PERMISSIONS.ROLES_ASSIGN_PERMISSIONS,
      module: 'roles',
    },
    {
      description: 'Assign one or more roles to Mobee users.',
      key: USER_PERMISSIONS.USERS_ASSIGN_ROLES,
      module: 'users',
    },
    {
      description: 'Create and provision Mobee users.',
      key: USER_PERMISSIONS.USERS_CREATE,
      module: 'users',
    },
    {
      description: 'View Mobee users.',
      key: USER_PERMISSIONS.USERS_VIEW,
      module: 'users',
    },
    {
      description: 'Update Mobee users and manage their status or credentials.',
      key: USER_PERMISSIONS.USERS_UPDATE,
      module: 'users',
    },
  ];

  for (const permission of permissionSeeds) {
    const title = permission.key.split('.').map((part) => part.replace(/_/g, ' '))
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' — ');
    await db.insert(permissions).values({
      ...permission,
      category: permission.module,
      isSystem: true,
      mainCategory: permissionMainCategory(permission.module),
      priority: 100,
      title,
    }).onDuplicateKeyUpdate({
      set: {
        category: permission.module,
        description: permission.description,
        isSystem: true,
        mainCategory: permissionMainCategory(permission.module),
        module: permission.module,
        title,
      },
    });
  }

  const [[location], [adminRole], adminPermissions, firebaseUser] = await Promise.all([
    db.select().from(locations).where(eq(locations.id, headOffice.id)).limit(1),
    db.select().from(roles).where(eq(roles.name, USER_ROLES.ADMIN)).limit(1),
    db.select().from(permissions),
    getOrCreateFirebaseAdministrator(),
  ]);

  if (!location || !adminRole) throw new Error('Failed to seed administrator prerequisites.');

  for (const permission of adminPermissions) {
    await db.insert(rolePermissions).values({
      permissionId: permission.id,
      roleId: adminRole.id,
    }).onDuplicateKeyUpdate({ set: { permissionId: permission.id } });
  }

  const generalDataPermission = adminPermissions.find(({ key }) => key === USER_ACCESS.GENERAL_DATA);
  const allRoles = await db.select({ id: roles.id, name: roles.name }).from(roles);
  if (!generalDataPermission) throw new Error('Failed to seed GENERAL_DATA permission.');
  for (const role of allRoles.filter(({ name }) => name !== USER_ROLES.PENDING)) {
    await db.insert(rolePermissions).values({
      permissionId: generalDataPermission.id,
      roleId: role.id,
    }).onDuplicateKeyUpdate({ set: { permissionId: generalDataPermission.id } });
  }

  await db.insert(users).values({
    defaultLocationId: location.id,
    displayName: firebaseUser.displayName ?? 'Mobee Administrator',
    email: env.BOOTSTRAP_ADMIN_EMAIL,
    firebaseUid: firebaseUser.uid,
    isActive: true,
    passwordHash: null,
    timestamp,
    username: env.BOOTSTRAP_ADMIN_EMAIL,
  }).onDuplicateKeyUpdate({
    set: {
      firebaseUid: firebaseUser.uid,
      isActive: true,
    },
  });

  const [administrator] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUser.uid)).limit(1);
  if (!administrator) throw new Error('Failed to seed the administrator user.');

  await db.insert(userRoles).values({
    assignedBy: administrator.id,
    locationId: location.id,
    roleId: adminRole.id,
    timestamp,
    userId: administrator.id,
  }).onDuplicateKeyUpdate({ set: { assignedBy: administrator.id, timestamp } });
};
