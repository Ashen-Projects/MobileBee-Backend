import { z } from 'zod';

const money = z.coerce.number().min(0);

export const repairJobIdSchema = z.coerce.number().int().positive();

export const listRepairJobsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional().default(''),
  status: z.enum(['all', 'received', 'inspection', 'waitingParts', 'inProgress', 'completed', 'delivered', 'cancelled']).default('all'),
}).strict();

export const repairCustomerSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1, 'Customer name is required.').max(255).optional(),
  phone: z.string().trim().min(1, 'Customer phone number is required.').max(30).optional(),
}).superRefine((customer, ctx) => {
  if (customer.id) return;
  if (!customer.name) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Customer name is required.', path: ['name'] });
  if (!customer.phone) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Customer phone number is required.', path: ['phone'] });
});

const repairImageSchema = z.object({
  cloudinaryPublicId: z.string().trim().max(512).regex(/^[A-Za-z0-9_/-]+$/, 'Invalid repair image reference.'),
  fileName: z.string().trim().min(1, 'Image file name is required.').max(255),
}).strict();

export const createRepairJobSchema = z.object({
  assignedTo: z.number().int().positive().optional().nullable(),
  customer: repairCustomerSchema,
  deviceName: z.string().trim().min(1, 'Device name is required.').max(255),
  estimatedCost: money.default(0),
  problemDescription: z.string().trim().min(1, 'Problem description is required.').max(3000),
  intakePhotos: z.array(repairImageSchema).max(10, 'A repair job can have up to 10 intake photos.').default([]),
  serialImei: z.string().trim().max(255).optional().nullable(),
}).strict();

export const updateRepairStatusSchema = z.object({
  inspectionPhotos: z.array(repairImageSchema).max(10, 'You can add up to 10 inspection photos at once.').default([]),
  note: z.string().trim().max(2000).optional(),
  status: z.enum(['received', 'inspection', 'waitingParts', 'inProgress', 'completed', 'delivered', 'cancelled']),
}).strict().superRefine((data, context) => {
  if (data.status === 'inspection' && data.inspectionPhotos.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Add at least one inspection photo before moving this repair to Inspection.',
      path: ['inspectionPhotos'],
    });
  }
  if (data.status !== 'inspection' && data.inspectionPhotos.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Inspection photos can only be attached when moving a repair to Inspection.',
      path: ['inspectionPhotos'],
    });
  }
});

export const publicRepairStatusSchema = z.object({
  jobNo: z.string().trim().min(1).max(100),
  token: z.string().trim().min(16).max(128),
}).strict();
