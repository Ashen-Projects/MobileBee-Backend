import { logger } from '../logger/logger';

export const initializeCronJobs = (): void => {
  logger.info('No scheduled jobs are registered.');
};
