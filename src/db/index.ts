import { drizzle } from 'drizzle-orm/mysql2';
import * as mysql from 'mysql2/promise';

import { databaseEnv } from '../env';
import * as schema from './schema';

export const pool = mysql.createPool({
  host: databaseEnv.host,
  user: databaseEnv.user,
  password: databaseEnv.password,
  database: databaseEnv.name,
  port: databaseEnv.port,
  waitForConnections: true,
  connectionLimit: databaseEnv.connectionLimit,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 10000,
});

export const db = drizzle(pool, { schema, mode: 'default' });

export type Database = typeof db;

export const checkDatabaseConnection = async (): Promise<void> => {
  await pool.query('SELECT 1');
};

export const closeDatabaseConnection = async (): Promise<void> => {
  await pool.end();
};

export default db;
