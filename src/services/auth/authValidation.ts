import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const createUserSchema = z.object({
  defaultLocationId: z.number().int().positive(),
  displayName: z.string().trim().min(2).max(255),
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128).optional(),
  phone: z.string().trim().max(30).optional(),
  roleIds: z.array(z.number().int().positive()).min(1),
  username: z.string().trim().min(3).max(100),
});
