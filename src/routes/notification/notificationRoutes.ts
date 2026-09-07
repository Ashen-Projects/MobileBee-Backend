import { Router } from 'express';

import * as controller from '../../controllers/notification/notificationController';
import { asyncHandler } from '../../utils/async-handler';

export const notificationRoutes = Router();

notificationRoutes.get('/', asyncHandler(controller.list));
notificationRoutes.get('/unread-count', asyncHandler(controller.unreadCount));
notificationRoutes.patch('/read-all', asyncHandler(controller.readAll));
notificationRoutes.patch('/:id/read', asyncHandler(controller.read));
