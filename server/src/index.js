const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');

const config = require('./config');
const logger = require('./config/logger');
const { testConnection } = require('./config/database');
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
const eteaRoutes = require('./routes/etea');
const eteaPaymentRoutes = require('./routes/eteaPayments');
const transactionRoutes = require('./routes/transactions');
const settingsRoutes = require('./routes/settings');
const notificationRoutes = require('./routes/notifications');
const auditRoutes = require('./routes/audit');
const reportRoutes = require('./routes/reports');
const oneLinkRoutes = require('./routes/onelink');

const app = express();

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
// Only apply the general rate limiter in production to avoid blocking local development
if (config.nodeEnv === 'production') {
  app.use('/api/', limiter);
}

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many authentication attempts, please try again later' },
});
app.use('/api/auth/login', authLimiter);

// ---- Body parsing ----
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
app.use('/api/etea', eteaRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/reports', reportRoutes);

// 1LINK / 1BILL gateway endpoints — must be registered BEFORE the broad app.use('/api', ...) mounts
// because transactionRoutes / settingsRoutes apply router.use(authenticate) which intercepts ALL /api/** requests
app.use('/api/1.0/Payments', oneLinkRoutes);

// Broad /api mounts (have global authenticate middleware inside)
app.use('/api', eteaPaymentRoutes);
app.use('/api', transactionRoutes);
app.use('/api', settingsRoutes);
// ---- Health check ----
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'billing-brilliance-api',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// ---- Error handling ----
app.use(notFound);
app.use(errorHandler);

// ---- Start server ----
const startServer = async () => {
  try {
    await testConnection();
    logger.info('Database connected successfully');
    await ensureProtectedAdmin();

    app.listen(config.port, () => {
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

startServer();

module.exports = app;
