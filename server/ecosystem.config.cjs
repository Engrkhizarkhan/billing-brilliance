module.exports = {
  apps: [
    {
      name: 'Fintap-api-backend',
      cwd: __dirname,
      script: 'src/index.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      kill_timeout: 20000,
      listen_timeout: 15000,
      env: { NODE_ENV: 'production', APP_ENVIRONMENT: 'production' },
    },
    {
      name: 'Fintap-outbox-worker',
      cwd: __dirname,
      script: 'src/workers/outboxWorker.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '256M',
      kill_timeout: 20000,
      env: { NODE_ENV: 'production', APP_ENVIRONMENT: 'production' },
    },
  ],
};
