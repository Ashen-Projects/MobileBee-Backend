import { Router } from 'express';

import { healthRoutes } from './health/healthRoutes';
import { authRoutes } from './auth/authRoutes';
import { userRoutes } from './user/userRoutes';
import { roleRoutes } from './role/roleRoutes';
import { customerRoutes } from './customer/customerRoutes';
import { productRoutes } from './product/productRoutes';
import { supplierRoutes } from './purchasing/supplier/supplierRoutes';
import { purchaseOrderRoutes } from './purchasing/purchaseOrder/purchaseOrderRoutes';
import { grnRoutes } from './purchasing/grn/grnRoutes';
import { documentSequenceRoutes } from './settings/documentSequenceRoutes';
import { locationRoutes } from './settings/locationRoutes';
import { stockRoutes } from './inventory/stock/stockRoutes';
import { saleRoutes } from './pos/saleRoutes';
import { drawerRoutes } from './pos/drawerRoutes';
import { publicRepairStatusRoutes, repairRoutes } from './repair/repairRoutes';
import { requireAuth } from '../middlewares/authMiddleware';

export const apiRoutes = Router();

apiRoutes.use('/health', healthRoutes);
apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/repair-status', publicRepairStatusRoutes);

// All API modules registered below this line are authenticated by default.
apiRoutes.use(requireAuth);
apiRoutes.use('/users', userRoutes);
apiRoutes.use('/roles', roleRoutes);
apiRoutes.use('/customers', customerRoutes);
apiRoutes.use('/products', productRoutes);
apiRoutes.use('/suppliers', supplierRoutes);
apiRoutes.use('/purchase-orders', purchaseOrderRoutes);
apiRoutes.use('/grns', grnRoutes);
apiRoutes.use('/locations', locationRoutes);
apiRoutes.use('/document-sequences', documentSequenceRoutes);
apiRoutes.use('/stock', stockRoutes);
apiRoutes.use('/pos-drawers', drawerRoutes);
apiRoutes.use('/sales', saleRoutes);
apiRoutes.use('/repairs', repairRoutes);
