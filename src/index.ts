import type { Server } from 'node:http';

import { app } from './app';
import { env } from './env';
import { checkDatabaseConnection, closeDatabaseConnection } from './db';
import { seedDatabase } from './db/seed';
import { initializeCronJobs } from './cronJobs';
import { logger } from './logger/logger';

let server: Server | undefined;

const start = async (): Promise<void> => {
  try {
    await checkDatabaseConnection();
    await seedDatabase();
    initializeCronJobs();
    server = app.listen(env.PORT, '0.0.0.0', () => {
      logger.info(`API server listening on port ${env.PORT}.`);
    });
  } catch (error) {
    logger.error('Failed to initialize the API.', {
      error: error instanceof Error ? error.message : String(error),
    });
    await closeDatabaseConnection();
    process.exit(1);
  }
};

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  console.log(`${signal} received. Shutting down gracefully.`);

  if (!server) {
    await closeDatabaseConnection();
    process.exit();
  }

  server.close(async (error) => {
    if (error) {
      console.error('Error while closing HTTP server.', error);
      process.exitCode = 1;
    }

    try {
      await closeDatabaseConnection();
      process.exit();
    } catch (databaseError) {
      console.error('Error while closing database connection.', databaseError);
      process.exit(1);
    }
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

void start();
