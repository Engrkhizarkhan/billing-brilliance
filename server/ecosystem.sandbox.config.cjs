const path = require('path');

const sandboxEnvironment = {
  NODE_ENV: 'production',
  APP_ENVIRONMENT: 'sandbox',
  PORT: 3001,
  FINTAP_ENV_FILE: path.join(__dirname, '.env.sandbox'),
};

module.exports = {
  apps: [
    {
      name: 'Fintap-sandbox-api',
      cwd: __dirname,
      script: 'src/index.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '384M',
      kill_timeout: 20000,
      listen_timeout: 15000,
      env: sandboxEnvironment,
    },
    {
      name: 'Fintap-sandbox-outbox-worker',
      cwd: __dirname,
      script: 'src/workers/outboxWorker.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '192M',
      kill_timeout: 20000,
      env: sandboxEnvironment,
    },
  ],
};
