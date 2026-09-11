const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const crypto = require('crypto');

const config = require('./config');
const logger = require('./config/logger');
const { pool, testConnection } = require('./config/database');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { ensureProtectedAdmin } = require('./services/protectedAdmin');
const { assertDatabaseMigrationsCurrent } = require('./services/migrationReadinessService');
const { validateApiKeyEncryptionKey } = require('./services/apiKeyService');

// Route imports
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const tenantRoutes = require('./routes/tenants');
const studentRoutes = require('./routes/students');
const invoiceRoutes = require('./routes/invoices');
const billingRoutes = require('./routes/billing');
const applicantRoutes = require('./routes/applicants');
const orgRoutes = require('./routes/org');
const orgPaymentRoutes = require('./routes/orgPayments');
const transactionRoutes = require('./routes/transactions');
const settingsRoutes = require('./routes/settings');
const notificationRoutes = require('./routes/notifications');
const auditRoutes = require('./routes/audit');
const reportRoutes = require('./routes/reports');
const oneLinkRoutes = require('./routes/onelink');
const saasGatewayRoutes = require('./routes/saasGateway');
const manualPaymentRoutes = require('./routes/manualPayments');
const sandboxAdminRoutes = require('./routes/sandboxAdmin');
const consumerRegistryRoutes = require('./routes/consumerRegistry');

// ---- Startup security guards ----
const INSECURE_DEFAULTS = ['change-me-in-production', 'change-refresh-in-production', 'your_jwt_secret_here_change_in_production', 'your_refresh_secret_here_change_in_production'];
if (config.nodeEnv === 'production') {
  if (!['production', 'sandbox'].includes(config.appEnvironment)) {
    console.error('FATAL: APP_ENVIRONMENT must be production or sandbox in NODE_ENV=production.');
    process.exit(1);
  }
  if (config.appEnvironment === 'sandbox' && !/(sandbox|uat|test)/i.test(config.db.database)) {
    console.error('FATAL: Sandbox runtime must use a database name containing sandbox, uat, or test.');
    process.exit(1);
  }
  if (!config.requireHttps) {
    console.error('FATAL: REQUIRE_HTTPS must be enabled in production. Terminate TLS at the trusted reverse proxy and forward X-Forwarded-Proto.');
    process.exit(1);
  }
  if (INSECURE_DEFAULTS.includes(config.jwt.secret)) {
    console.error('FATAL: JWT_SECRET is set to an insecure default value. Set a strong random secret before deploying.');
    process.exit(1);
  }
  if (INSECURE_DEFAULTS.includes(config.jwt.refreshSecret)) {
    console.error('FATAL: JWT_REFRESH_SECRET is set to an insecure default value. Set a strong random secret before deploying.');
    process.exit(1);
  }
  if (!config.db.user || !config.db.password) {
    console.error('FATAL: DB_USER or DB_PASSWORD is not set. Configure real database credentials before deploying.');
    process.exit(1);
  }
  if (config.appEnvironment === 'production' && (!config.onebill.username || !config.onebill.password || ['demo-user', 'demo-pass'].includes(config.onebill.username) || ['demo-user', 'demo-pass'].includes(config.onebill.password))) {
    console.error('FATAL: Configure non-default ONELINK_USERNAME and ONELINK_PASSWORD values before deploying.');
    process.exit(1);
  }
  if (config.appEnvironment === 'production' && config.onebill.allowedIps.length === 0) {
    console.error('FATAL: Configure ONELINK_ALLOWED_IPS before deploying 1BILL endpoints.');
    process.exit(1);
  }
  if (!/^\d{6}$/.test(config.fintechPrefix)) {
    console.error('FATAL: FINTECH_PREFIX must be the six-digit prefix assigned by 1LINK.');
    process.exit(1);
  }
  if (config.org.requireWebhookSignature && (!config.org.webhookSecret || config.org.webhookSecret === 'change-me')) {
    console.error('FATAL: Configure a strong ORG_WEBHOOK_SECRET when webhook signatures are enabled.');
    process.exit(1);
  }
  if (!/^\d{6}$/.test(config.admin.actionPin)) {
    console.error('FATAL: ADMIN_ACTION_PIN must be exactly six digits.');
    process.exit(1);
  }
  try {
    validateApiKeyEncryptionKey();
  } catch (error) {
    console.error(`FATAL: ${error.message}`);
    process.exit(1);
  }
  if (config.appEnvironment === 'production' && (!config.sandbox.baseUrl || !config.sandbox.purgeSecret)) {
    console.warn('WARNING: Isolated sandbox is not configured. Core production APIs will start, but sandbox provisioning and production activation remain blocked until SANDBOX_BASE_URL and SANDBOX_PURGE_SECRET are configured.');
  }
  if (config.appEnvironment === 'sandbox' && !config.sandbox.purgeSecret) {
    console.error('FATAL: SANDBOX_PURGE_SECRET is required so the production control plane can provision and retire sandbox tenants.');
    process.exit(1);
  }
}

const app = express();

// Trust exactly one reverse-proxy hop (nginx).
// This makes req.ip reflect the real client IP from X-Forwarded-For
// instead of nginx's loopback address (127.0.0.1).
// Keep this at 1 (not true) to prevent callers from spoofing their IP
// by injecting a fake X-Forwarded-For header directly.
if (config.trustProxyHops > 0) {
  app.set('trust proxy', config.trustProxyHops);
}

if (config.nodeEnv === 'production' && config.requireHttps) {
  app.use((req, res, next) => {
    if (req.secure) return next();
    return res.status(426).json({ error: 'HTTPS is required', code: 'HTTPS_REQUIRED' });
  });
}

// ---- Security middleware ----
app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Webhook-Signature', 'X-Idempotency-Key', 'X-Tenant-Id'],
}));
app.use(hpp());

// ---- Rate limiting ----
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later' },
  skip: (req) => req.path.startsWith('/1.0/Payments') || req.path.startsWith('/saas/v1'),
});
app.use('/api/', limiter);

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many authentication attempts, please try again later' },
});
app.use('/api/auth/login', authLimiter);

// ---- Body parsing ----
// 100 KB default limit; bulk endpoints set their own higher limit
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// ---- Request logging ----
const morganFormat = config.nodeEnv === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  stream: { write: (message) => logger.http(message.trim()) },
}));

if (config.appEnvironment === 'sandbox') {
  app.use('/internal/sandbox', sandboxAdminRoutes);
}

// ---- API Routes ----
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/applicants', applicantRoutes);
app.use('/api/org', orgRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/manual-payments', manualPaymentRoutes);
app.use('/api/admin/consumers', consumerRegistryRoutes);

// Dedicated rate limiter for 1LINK gateway endpoints — always applied (even in dev)
// because these are externally reachable endpoints called by the payment gateway.
const oneLinkLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimit.oneLinkMaxPerMinute,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests to payment gateway endpoint' },
});

// 1LINK / 1BILL gateway endpoints — must be registered BEFORE the broad app.use('/api', ...) mounts
// because transactionRoutes / settingsRoutes apply router.use(authenticate) which intercepts ALL /api/** requests
if (config.appEnvironment === 'sandbox') {
  // Stop the request before broad authenticated /api routers can make this
  // disabled bank-facing namespace look like a valid protected endpoint.
  app.use('/api/1.0/Payments', notFound);
} else {
  app.use('/api/1.0/Payments', oneLinkLimiter, oneLinkRoutes);
}

// SaaS payment gateway (external — authenticated by per-tenant API key)
const saasLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimit.saasMaxPerMinute,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => crypto.createHash('sha256').update(String(req.headers['x-api-key'] || 'missing-api-key')).digest('hex'),
  message: { message: 'Tenant API rate limit exceeded' },
});
app.use('/api/saas/v1', saasLimiter, saasGatewayRoutes);

// Orchestrator readiness probe. Liveness remains available at /api/health.
app.get('/api/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready', service: 'fintap-api', environment: config.appEnvironment, timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'not_ready', service: 'fintap-api', environment: config.appEnvironment, timestamp: new Date().toISOString() });
  }
});

// Liveness must stay unauthenticated so infrastructure can detect a running process.
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'fintap-api',
    environment: config.appEnvironment,
    timestamp: new Date().toISOString(),
  });
});

// Broad /api mounts (have global authenticate middleware inside)
app.use('/api', orgPaymentRoutes);
app.use('/api', transactionRoutes);
app.use('/api', settingsRoutes);

// ---- Error handling ----
app.use(notFound);
app.use(errorHandler);

// ---- Start server ----
let httpServer;
const startServer = async () => {
  try {
    const connected = await testConnection();
    if (!connected) {
      logger.error('Cannot connect to database. Exiting.');
      process.exit(1);
    }
    logger.info('Database connected successfully');

    await assertDatabaseMigrationsCurrent(pool);

    await ensureProtectedAdmin();

    httpServer = app.listen(config.port, '127.0.0.1', () => {
      logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
      logger.info(`API base URL: http://localhost:${config.port}/api`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
};

const shutdown = (signal) => {
  logger.info(`Received ${signal}; draining HTTP connections`);
  const forceTimer = setTimeout(() => process.exit(1), 15000);
  forceTimer.unref();
  const finish = async () => {
    try { await pool.end(); } finally {
      clearTimeout(forceTimer);
      process.exit(0);
    }
  };
  if (httpServer) httpServer.close(() => { void finish(); });
  else void finish();
};

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

if (require.main === module) {
  startServer();
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
