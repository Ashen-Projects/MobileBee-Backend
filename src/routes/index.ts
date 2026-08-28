import { Router } from 'express';

import { healthRoutes } from './health/healthRoutes';
import { authRoutes } from './auth/authRoutes';
import { userRoutes } from './user/userRoutes';
import { roleRoutes } from './role/roleRoutes';
import { productRoutes } from './product/productRoutes';
import { supplierRoutes } from './purchasing/supplier/supplierRoutes';
import { purchaseOrderRoutes } from './purchasing/purchaseOrder/purchaseOrderRoutes';
import { requireAuth } from '../middlewares/authMiddleware';

export const apiRoutes = Router();

apiRoutes.use('/health', healthRoutes);
apiRoutes.use('/auth', authRoutes);

// All API modules registered below this line are authenticated by default.
apiRoutes.use(requireAuth);
apiRoutes.use('/users', userRoutes);
apiRoutes.use('/roles', roleRoutes);
apiRoutes.use('/products', productRoutes);
apiRoutes.use('/suppliers', supplierRoutes);
apiRoutes.use('/purchase-orders', purchaseOrderRoutes);
