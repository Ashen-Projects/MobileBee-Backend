import 'dotenv/config';

import { z } from 'zod';

const corsOriginSchema = z
  .string()
  .min(1)
  .refine((value) => value === '*' || z.url().safeParse(value).success, {
    message: 'CORS_ORIGIN must be "*" or a valid URL.',
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().max(65535),
  CORS_ORIGIN: corsOriginSchema,
  DATABASE_URL: z.string().min(1).optional(),
  DB_HOST: z.string().min(1).optional(),
  DB_USER: z.string().min(1).optional(),
  DB_PASSWORD: z.string().optional(),
  DB_NAME: z.string().min(1).optional(),
  DB_PORT: z.coerce.number().int().positive().max(65535).optional(),
  DB_CONNECTION_LIMIT: z.coerce.number().int().positive().default(10),
  MYSQL_ROOT_PASSWORD: z.string().min(1).optional(),
  MYSQL_DATABASE: z.string().min(1).optional(),
  MYSQL_USER: z.string().min(1).optional(),
  MYSQL_PASSWORD: z.string().optional(),
  MYSQL_PORT: z.coerce.number().int().positive().max(65535).optional(),
  FIREBASE_SERVICE_ACCOUNT: z.string().min(1),
  FIREBASE_WEB_API_KEY: z.string().min(1),
  BOOTSTRAP_ADMIN_EMAIL: z.email().default('damjithfernando1@gmail.com'),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12),
  AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  AUTH_LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const formattedErrors = parsedEnv.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  throw new Error(`Invalid environment variables:\n${formattedErrors}`);
}

export const env = parsedEnv.data;

const databaseHost = env.DB_HOST ?? 'localhost';
const databaseUser = env.DB_USER ?? env.MYSQL_USER;
const databasePassword = env.DB_PASSWORD ?? env.MYSQL_PASSWORD ?? '';
const databaseName = env.DB_NAME ?? env.MYSQL_DATABASE;
const databasePort = env.DB_PORT ?? env.MYSQL_PORT ?? 3306;

if (!databaseUser || !databaseName) {
  throw new Error('Invalid database configuration: DB_USER and DB_NAME are required.');
}

export const databaseEnv = {
  host: databaseHost,
  user: databaseUser,
  password: databasePassword,
  name: databaseName,
  port: databasePort,
  connectionLimit: env.DB_CONNECTION_LIMIT,
  url:
    env.DATABASE_URL ??
    `mysql://${encodeURIComponent(databaseUser)}:${encodeURIComponent(databasePassword)}@${databaseHost}:${databasePort}/${databaseName}`,
};
