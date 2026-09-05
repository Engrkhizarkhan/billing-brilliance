const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');

const config = require('./config');
const logger = require('./config/logger');
const { pool, testConnection } = require('./config/database');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { ensureProtectedAdmin } = require('./services/protectedAdmin');

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
const fetchBundleRoutes = require('./routes/fetchbundle');
const bundleRoutes = require('./routes/bundles');
const saasGatewayRoutes = require('./routes/saasGateway');
const adminToolsRoutes = require('./routes/adminTools');

// ---- Startup security guards ----
const INSECURE_DEFAULTS = ['change-me-in-production', 'change-refresh-in-production', 'your_jwt_secret_here_change_in_production', 'your_refresh_secret_here_change_in_production'];
if (config.nodeEnv === 'production') {
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
  if (!config.onebill.username || !config.onebill.password || ['demo-user', 'demo-pass'].includes(config.onebill.username) || ['demo-user', 'demo-pass'].includes(config.onebill.password)) {
    console.error('FATAL: Configure non-default ONELINK_USERNAME and ONELINK_PASSWORD values before deploying.');
    process.exit(1);
  }
  if (config.onebill.allowedIps.length === 0) {
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
}

const app = express();

// Trust exactly one reverse-proxy hop (nginx).
// This makes req.ip reflect the real client IP from X-Forwarded-For
// instead of nginx's loopback address (127.0.0.1).
// Keep this at 1 (not true) to prevent callers from spoofing their IP
// by injecting a fake X-Forwarded-For header directly.
if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1);
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

// Dedicated rate limiter for 1LINK gateway endpoints — always applied (even in dev)
// because these are externally reachable endpoints called by the payment gateway.
const oneLinkLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests to payment gateway endpoint' },
});

// 1LINK / 1BILL gateway endpoints — must be registered BEFORE the broad app.use('/api', ...) mounts
// because transactionRoutes / settingsRoutes apply router.use(authenticate) which intercepts ALL /api/** requests
app.use('/api/1.0/Payments', oneLinkLimiter, oneLinkRoutes);

// 1LINK FetchBundle endpoint (external — authenticated by 1LINK credentials)
app.use('/v1/Transaction', oneLinkLimiter, fetchBundleRoutes);

// SaaS payment gateway (external — authenticated by per-tenant API key)
app.use('/api/saas/v1', saasGatewayRoutes);

// Admin bundle management
app.use('/api/bundles', bundleRoutes);

// Admin dev / maintenance tools (authenticate + authorize inside the router)
app.use('/api/admin', adminToolsRoutes);

// Orchestrator readiness probe. Liveness remains available at /api/health.
app.get('/api/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready', service: 'payniva-api', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'not_ready', service: 'payniva-api', timestamp: new Date().toISOString() });
  }
});

// Liveness must stay unauthenticated so infrastructure can detect a running process.
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'payniva-api',
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
const startServer = async () => {
  try {
    const connected = await testConnection();
    if (!connected) {
      logger.error('Cannot connect to database. Exiting.');
      process.exit(1);
    }
    logger.info('Database connected successfully');

    // Auto-migrate: rename legacy etea_* tables and enum values to org_*
    const { pool } = require('./config/database');
    const migrations = [
      { check: "SHOW TABLES LIKE 'etea_postings'", rename: 'RENAME TABLE etea_postings TO org_postings' },
      { check: "SHOW TABLES LIKE 'etea_payment_records'", rename: 'RENAME TABLE etea_payment_records TO org_payment_records' },
      { check: "SHOW TABLES LIKE 'etea_payment_notifications'", rename: 'RENAME TABLE etea_payment_notifications TO org_payment_notifications' },
    ];
    for (const m of migrations) {
      const [rows] = await pool.query(m.check);
      if (rows.length > 0) {
        await pool.query(m.rename);
        logger.info(`Auto-migration: ${m.rename}`);
      }
    }
    // Normalize legacy 'etea' role and type values
    await pool.query("UPDATE users SET role = 'org' WHERE role = 'etea'");
    await pool.query("UPDATE tenants SET type = 'org' WHERE type = 'etea'");

    await ensureProtectedAdmin();

    app.listen(config.port, '127.0.0.1', () => {
      logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
      logger.info(`API base URL: http://localhost:${config.port}/api`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
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
}

module.exports = app;
