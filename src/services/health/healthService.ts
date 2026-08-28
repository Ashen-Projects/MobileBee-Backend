import { env } from '../../env';
import { checkDatabaseConnection } from '../../db';

export type HealthResponse = {
  application: string;
  status: 'operational';
  database: 'connected';
  environment: typeof env.NODE_ENV;
  uptimeSeconds: number;
  timestamp: string;
};

export const getHealthStatus = async (): Promise<HealthResponse> => {
  await checkDatabaseConnection();

  return {
    application: 'mobile-shop-pos-backend',
    status: 'operational',
    database: 'connected',
    environment: env.NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
};
