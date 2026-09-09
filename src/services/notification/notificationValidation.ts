import { z } from 'zod';

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
  status: z.enum(['all', 'read', 'unread']).default('all'),
}).strict();

export const notificationIdSchema = z.coerce.number().int().positive();

export const createNotificationSchema = z.object({
  entityId: z.number().int().positive().optional(),
  entityType: z.string().trim().max(80).optional(),
  locationId: z.number().int().positive().nullable().optional(),
  message: z.string().trim().min(1).max(2000),
  module: z.string().trim().min(1).max(80).default('general'),
  severity: z.enum(['info', 'success', 'warning', 'critical']).default('info'),
  targetPermission: z.string().trim().max(150).nullable().optional(),
  targetUserId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(1).max(180),
}).strict();

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
