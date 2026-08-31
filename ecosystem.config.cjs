module.exports = {
  apps: [
    {
      name: 'mobilebee-backend',
      script: 'dist/index.js',
      cwd: '/www/projects/MobileBee-Backend/current',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      kill_timeout: 10000,
      listen_timeout: 10000,
      exp_backoff_restart_delay: 100,
      time: true,
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
