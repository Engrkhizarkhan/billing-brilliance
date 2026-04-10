require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

module.exports = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    database: process.env.DB_NAME || 'billing_brilliance',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
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
  },

  apiKey: process.env.API_KEY || 'change-me-in-production',

  etea: {
    callbackUrl: process.env.ETEA_CALLBACK_URL || '/api/payment/callback',
    notificationUrl: process.env.ETEA_NOTIFICATION_URL || '',  // ETEA's webhook endpoint — set in .env
    webhookSecret: process.env.ETEA_WEBHOOK_SECRET || 'change-me',
    paymentExpiryHours: parseInt(process.env.ETEA_PAYMENT_EXPIRY_HOURS, 10) || 48,
    allowedIps: (process.env.ETEA_ALLOWED_IPS || '127.0.0.1,::1').split(',').map(s => s.trim()).filter(Boolean),
    requireWebhookSignature: (process.env.REQUIRE_WEBHOOK_SIGNATURE || 'true').toLowerCase() !== 'false',
  },

  onebill: {
    baseUrl: process.env.ONEBILL_BASE_URL || 'https://sandbox.onebill.local',
    useMock: (process.env.ONEBILL_USE_MOCK || 'true') !== 'false',
    timeoutMs: parseInt(process.env.ONEBILL_TIMEOUT_MS, 10) || 8000,
    username: process.env.ONELINK_USERNAME || 'demo-user',
    password: process.env.ONELINK_PASSWORD || 'demo-pass',
    bankMnemonic: process.env.ONELINK_BANK_MNEMONIC || 'MBLINK01',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },

  fintechPrefix: process.env.FINTECH_PREFIX || '123456',
  logLevel: process.env.LOG_LEVEL || 'info',
};
