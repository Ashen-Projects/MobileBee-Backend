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

export const createRepairJobSchema = z.object({
  assignedTo: z.number().int().positive().optional().nullable(),
  customer: repairCustomerSchema,
  deviceName: z.string().trim().min(1, 'Device name is required.').max(255),
  estimatedCost: money.default(0),
  problemDescription: z.string().trim().min(1, 'Problem description is required.').max(3000),
  serialImei: z.string().trim().max(255).optional().nullable(),
}).strict();

export const updateRepairStatusSchema = z.object({
  note: z.string().trim().max(2000).optional(),
  status: z.enum(['received', 'inspection', 'waitingParts', 'inProgress', 'completed', 'delivered', 'cancelled']),
}).strict();

export const publicRepairStatusSchema = z.object({
  jobNo: z.string().trim().min(1).max(100),
  token: z.string().trim().min(16).max(128),
}).strict();
