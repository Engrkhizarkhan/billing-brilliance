const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '../../.env');
const loadedEnv = dotenv.config({ path: envPath }).parsed || {};
const fileFirst = (name) => Object.prototype.hasOwnProperty.call(loadedEnv, name)
  ? loadedEnv[name]
  : process.env[name];

module.exports = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  appEnvironment: process.env.APP_ENVIRONMENT || (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
  trustProxyHops: Math.max(0, parseInt(process.env.TRUST_PROXY_HOPS, 10)
    || (process.env.NODE_ENV === 'production' ? 1 : 0)),

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    database: process.env.DB_NAME || 'Fintap',
    user: process.env.DB_USER || 'root',
    password: Object.prototype.hasOwnProperty.call(process.env, 'DB_PASSWORD_OVERRIDE')
      ? (process.env.DB_PASSWORD_OVERRIDE === '__EMPTY__' ? '' : process.env.DB_PASSWORD_OVERRIDE)
      : (process.env.DB_PASSWORD || ''),
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 20,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-refresh-in-production',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  admin: {
    email: process.env.ADMIN_EMAIL || '',
    password: process.env.ADMIN_PASSWORD || '',
    name: process.env.ADMIN_NAME || 'Platform Administrator',
    // The local server/.env is authoritative for this operator secret. This
    // avoids an old PM2 environment snapshot silently overriding a rotated PIN.
    actionPin: fileFirst('ADMIN_ACTION_PIN') || (process.env.NODE_ENV === 'production' ? '' : '123456'),
  },

  apiKeyEncryptionKey: fileFirst('API_KEY_ENCRYPTION_KEY')
    || (process.env.NODE_ENV === 'production' ? '' : 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='),

  sandbox: {
    baseUrl: process.env.SANDBOX_BASE_URL || '',
    purgeSecret: process.env.SANDBOX_PURGE_SECRET || '',
  },

  requireHttps: (process.env.REQUIRE_HTTPS || 'false').toLowerCase() !== 'false',

  org: {
    callbackUrl: process.env.ORG_CALLBACK_URL || '/api/payment/callback',
    webhookSecret: process.env.ORG_WEBHOOK_SECRET || 'change-me',
    paymentExpiryHours: parseInt(process.env.ORG_PAYMENT_EXPIRY_HOURS, 10) || 48,
    requireWebhookSignature: (process.env.REQUIRE_WEBHOOK_SIGNATURE || 'true').toLowerCase() !== 'false',
  },

  onebill: {
    username: process.env.ONELINK_USERNAME || '',
    password: process.env.ONELINK_PASSWORD || '',
    bankMnemonic: process.env.ONELINK_BANK_MNEMONIC || 'MBLINK01',
    allowedIps: (process.env.ONELINK_ALLOWED_IPS || '')
      .split(',')
      .map((ip) => ip.trim().replace(/^::ffff:/, ''))
      .filter(Boolean),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    oneLinkMaxPerMinute: parseInt(process.env.ONELINK_RATE_LIMIT_PER_MINUTE, 10) || 600,
    saasMaxPerMinute: parseInt(process.env.SAAS_RATE_LIMIT_PER_MINUTE, 10) || 300,
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },

  fintechPrefix: process.env.FINTECH_PREFIX || '',
  logLevel: process.env.LOG_LEVEL || 'info',
};
