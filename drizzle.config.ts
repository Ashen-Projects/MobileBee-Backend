import 'dotenv/config';

import { defineConfig } from 'drizzle-kit';

const databaseHost = process.env.DB_HOST ?? 'localhost';
const databaseUser = process.env.DB_USER ?? process.env.MYSQL_USER ?? '';
const databasePassword = process.env.DB_PASSWORD ?? process.env.MYSQL_PASSWORD ?? '';
const databaseName = process.env.DB_NAME ?? process.env.MYSQL_DATABASE ?? '';
const databasePort = process.env.DB_PORT ?? process.env.MYSQL_PORT ?? '3306';

const databaseUrl =
  process.env.DATABASE_URL ??
  `mysql://${encodeURIComponent(databaseUser)}:${encodeURIComponent(databasePassword)}@${databaseHost}:${databasePort}/${databaseName}`;

export default defineConfig({
  dialect: 'mysql',
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
