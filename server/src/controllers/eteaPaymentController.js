const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const config = require('../config');

const FINTECH_PREFIX = config.fintechPrefix || '123456';
const { pool } = require('../config/database');
const logger = require('../config/logger');
const { AppError } = require('../middleware/errorHandler');
const { auditLog } = require('../middleware/auditLog');

const CALLBACK_URL = config.org.callbackUrl;
const ORG_NOTIFICATION_URL = config.org.notificationUrl; // Outbound: org's webhook to receive payment confirmations
const WEBHOOK_SECRET = config.org.webhookSecret;
const REQUIRE_WEBHOOK_SIGNATURE = config.org.requireWebhookSignature;
const DEFAULT_EXPIRY_HOURS = config.org.paymentExpiryHours;

// ---- Signature helpers ----
const toSignatureHash = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
};

const generateWebhookSignature = (callback) => {
  const paidAt = callback.paidAt || '';
  return toSignatureHash(`${callback.billId}|${callback.status}|${callback.transactionId}|${paidAt}|${WEBHOOK_SECRET}`);
};

const addHours = (date, hours) => {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
};

const normalizeCreateRequest = (body) => ({
  applicantId: (body.applicantId || body.applicant_id || '').trim(),
  applicationId: (body.applicationId || body.application_id || '').trim(),
  postingId: (body.postingId || body.posting_id || '').trim(),
  dueDate: (body.dueDate || body.due_date || '').trim(),
  expireAt: body.expireAt || body.expire_at || null,
  neverExpires: Boolean(body.neverExpires || body.never_expires),
  description: body.description?.trim(),
  customerName: (body.customerName || body.customer_name || body.applicantId || body.applicant_id || 'Applicant').trim(),
  amount: body.amount,
});

// ---- Assert security context ----
const assertSecurity = async (req, options = {}) => {
  // Protocol check
  const protocol = req.protocol || (req.headers['x-forwarded-proto'] || 'http');
  if (config.requireHttps && protocol !== 'https') {
    throw new AppError('HTTPS is required', 403, 'HTTPS_REQUIRED');
  }

  // If request is JWT-authenticated (dashboard users), skip API key and IP checks
  if (!req.user) {
    // API Key check for external integrations — tenant-specific key already validated by middleware
    // but assertSecurity may be reached directly, so check header presence only
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      throw new AppError('Invalid API key', 401, 'INVALID_API_KEY');
    }

    // Per-tenant IP whitelist — configured by org admin in settings, stored in DB
    if (req.tenantId) {
      const [settingRows] = await pool.query(
        "SELECT value FROM settings WHERE tenant_id = ? AND `key` = 'etea_security_context' LIMIT 1",
        [req.tenantId]
      );
      if (settingRows.length > 0) {
        let setting = {};
        try { setting = JSON.parse(settingRows[0].value); } catch { /* ignore malformed */ }
        const allowedIps = (setting.sourceIp || '').split(',').map(s => s.trim()).filter(Boolean);
        if (allowedIps.length > 0) {
          const raw = req.ip || req.connection?.remoteAddress || '';
          const ip = raw.startsWith('::ffff:') ? raw.slice(7) : raw;
          if (!allowedIps.includes(ip)) {
            throw new AppError('Source IP not whitelisted', 403, 'IP_BLOCKED');
          }
        }
      }
    }
  }

  // Webhook signature validation (only for callbacks)
  if (options.requireWebhookSignature && options.callback && REQUIRE_WEBHOOK_SIGNATURE) {
    const expected = generateWebhookSignature(options.callback);
    const provided = req.headers['x-webhook-signature'];
    if (!provided || provided !== expected) {
      throw new AppError('Invalid webhook signature', 401, 'INVALID_SIGNATURE');
    }
  }
};

// ---- Parse a MySQL DATETIME string (dateStrings:true) as UTC ----
const parseDbDate = (str) => new Date(String(str).replace(' ', 'T') + (String(str).includes('Z') || String(str).includes('+') ? '' : 'Z'));

// ---- Format a date value as MySQL DATETIME (YYYY-MM-DD HH:MM:SS UTC) ----
const toMySQLDatetime = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value).replace(' ', 'T') + (String(value).includes('Z') || String(value).includes('+') ? '' : 'Z'));
  if (isNaN(d.getTime())) return null;
  return d.toISOString().replace('T', ' ').slice(0, 19);
};

// ---- Expire stale payment ----
const ensurePaymentNotStale = async (payment) => {
  if (payment.status !== 'pending') return payment;
  if (parseDbDate(payment.expiry_date).getTime() > Date.now()) return payment;

  await pool.query('UPDATE org_payment_records SET status = ? WHERE id = ?', ['expired', payment.id]);
  return { ...payment, status: 'expired' };
};

// ---- POST /api/payments/create ----
const createPayment = async (req, res, next) => {
  try {
    await assertSecurity(req);

    const normalized = normalizeCreateRequest(req.body);
    const tenantId = req.tenantId || req.body.tenantId;

    if (!normalized.applicantId) throw new AppError('applicant_id is required', 400);
    if (!normalized.applicationId) throw new AppError('application_id is required', 400);
    if (!normalized.postingId) throw new AppError('posting_id is required', 400);
    if (!normalized.amount || normalized.amount <= 0) throw new AppError('Amount must be > 0', 400);

    // Check for existing payment (idempotent)
    const [existingRows] = await pool.query(
      'SELECT * FROM org_payment_records WHERE application_id = ? AND tenant_id = ?',
      [normalized.applicationId, tenantId]
    );

    if (existingRows.length > 0) {
      const existing = await ensurePaymentNotStale(existingRows[0]);
      return res.json({
        data: {
          paymentId: existing.id,
          billId: existing.bill_id,
          consumerNumber: existing.consumer_number || null,
          status: existing.status,
          payment: existing,
          oneBillRequest: buildOneBillPayload(existing, normalized.customerName),
        },
      });
    }

    // Resolve posting
    let description = normalized.description;
    if (!description) {
      const [postingRows] = await pool.query('SELECT title FROM org_postings WHERE id = ? AND deleted_at IS NULL', [normalized.postingId]);
      description = postingRows.length > 0
        ? `${postingRows[0].title} application fee`
        : `Payment for application ${normalized.applicationId}`;
    }

    const id = uuidv4();
    const createdAt = new Date().toISOString();
    // due_date: derive from expireAt date portion if provided, otherwise default to today+2
    const dueDate = normalized.dueDate
      ? new Date(normalized.dueDate).toISOString().slice(0, 10)
      : normalized.expireAt
        ? new Date(normalized.expireAt).toISOString().slice(0, 10)
        : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    // never_expires = store a far-future date (year 9999) so expiry queries never trigger
    const expiryDate = normalized.neverExpires
      ? '9999-12-31T23:59:59.000Z'
      : normalized.expireAt
        ? new Date(normalized.expireAt).toISOString()
        : addHours(createdAt, DEFAULT_EXPIRY_HOURS);
    const billId = `ORG-${id.split('-')[0].toUpperCase()}`;

    // Generate a 1BILL-compatible consumer number for this payment record.
    // Format: FINTECH_PREFIX(6) + tenant biller_code(4) + timestamp(10) + random(4) = 24 chars.
    // Uses timestamp+random instead of COUNT(*) to avoid race conditions on concurrent creates.
    const [tenantRows] = await pool.query('SELECT biller_code FROM tenants WHERE id = ?', [tenantId]);
    if (!tenantRows.length) throw new AppError('Tenant not found', 404);
    const billerCode = tenantRows[0].biller_code;
    const ts = String(Date.now()).slice(-10);
    const rand = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
    const consumerNumber = `${FINTECH_PREFIX}${billerCode}${ts}${rand}`;

    await pool.query(
      `INSERT INTO org_payment_records (id, tenant_id, application_id, applicant_id, posting_id, bill_id, consumer_number, amount, status, due_date, expiry_date, created_at, description, callback_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
      [id, tenantId, normalized.applicationId, normalized.applicantId, normalized.postingId, billId, consumerNumber,
        normalized.amount, dueDate, expiryDate, createdAt, description, CALLBACK_URL]
    );

    const [rows] = await pool.query('SELECT * FROM org_payment_records WHERE id = ?', [id]);
    const payment = rows[0];

    await auditLog(req, 'create', 'org_payment', id, `Payment created for app ${normalized.applicationId}`);

    // Record notification
    await pool.query(
      'INSERT INTO org_payment_notifications (id, tenant_id, application_id, payment_id, bill_id, status) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), tenantId, normalized.applicationId, id, billId, 'pending']
    );

    res.status(201).json({
      data: {
        paymentId: payment.id,
        billId: payment.bill_id,
        consumerNumber: payment.consumer_number || null,
        status: payment.status,
        payment,
        oneBillRequest: buildOneBillPayload(payment, normalized.customerName),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ---- GET /api/payments/:applicationId ----
const getPaymentStatus = async (req, res, next) => {
  try {
    await assertSecurity(req);

    const { applicationId } = req.params;

    const [rows] = await pool.query(
      'SELECT * FROM org_payment_records WHERE application_id = ?',
      [applicationId]
    );

    if (rows.length === 0) {
      return res.json({ data: { applicationId, status: 'not_found' } });
    }

    const payment = await ensurePaymentNotStale(rows[0]);
    res.json({
      data: {
        applicationId,
        status: payment.status,
        payment,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ---- POST /api/payment/callback ----
const processPaymentCallback = async (req, res, next) => {
  try {
    const callback = req.body;
    await assertSecurity(req, { requireWebhookSignature: true, callback });

    const idempotencyKey = (req.headers['x-idempotency-key'] || '').trim();

    // Idempotency check
    if (idempotencyKey) {
      const [idemRows] = await pool.query(
        'SELECT response FROM callback_idempotency_log WHERE idempotency_key = ?',
        [idempotencyKey]
      );
      if (idemRows.length > 0) {
        return res.json(JSON.parse(idemRows[0].response));
      }
    }

    const storeIdempotency = async (response) => {
      if (idempotencyKey) {
        try {
          await pool.query(
            'INSERT INTO callback_idempotency_log (idempotency_key, tenant_id, response) VALUES (?, ?, ?)',
            [idempotencyKey, req.tenantId || '', JSON.stringify(response)]
          );
        } catch (e) {
          // Duplicate key - race condition, ignore
        }
      }
    };

    // Find payment by bill ID
    const [payRows] = await pool.query(
      'SELECT * FROM org_payment_records WHERE bill_id = ?',
      [callback.billId]
    );

    if (payRows.length === 0) {
      const response = { data: { acknowledged: false, message: `Bill ID ${callback.billId} not found` } };
      await storeIdempotency(response);
      return res.json(response);
    }

    const payment = await ensurePaymentNotStale(payRows[0]);

    // Duplicate transaction ID check
    if (callback.transactionId) {
      const [dupRows] = await pool.query(
        'SELECT id FROM org_payment_records WHERE transaction_id = ? AND bill_id != ?',
        [callback.transactionId, callback.billId]
      );
      if (dupRows.length > 0) {
        const response = {
          data: {
            acknowledged: false,
            payment,
            message: `Transaction ID ${callback.transactionId} already used for another bill`,
          },
        };
        await storeIdempotency(response);
        return res.json(response);
      }
    }

    // Duplicate paid callback
    if (payment.status === 'paid' && callback.status === 'paid') {
      const response = {
        data: {
          acknowledged: true,
          payment,
          message: 'Duplicate callback ignored; payment already marked paid',
        },
      };
      await storeIdempotency(response);
      return res.json(response);
    }

    // Apply update
    const updates = { status: callback.status, transaction_id: callback.transactionId };
    if (callback.status === 'paid') {
      updates.paid_at = toMySQLDatetime(callback.paidAt || new Date());
    }

    await pool.query(
      'UPDATE org_payment_records SET status = ?, transaction_id = ?, paid_at = ? WHERE id = ?',
      [updates.status, updates.transaction_id, updates.paid_at || null, payment.id]
    );

    // Record transaction in main transactions table
    if (callback.transactionId) {
      try {
        await pool.query(
          `INSERT INTO transactions (id, tenant_id, transaction_id, consumer_number, amount, status, date, biller_name, channel)
           VALUES (?, ?, ?, ?, ?, ?, CURDATE(), 'Org KPK', 'online')`,
          [uuidv4(), payment.tenant_id, callback.transactionId, payment.bill_id, payment.amount,
            callback.status === 'paid' ? 'completed' : callback.status === 'failed' ? 'failed' : 'pending']
        );
      } catch (e) {
        // Duplicate transaction - ignore
      }
    }

    const [updatedRows] = await pool.query('SELECT * FROM org_payment_records WHERE id = ?', [payment.id]);
    const updated = updatedRows[0];

    // Look up per-tenant webhook config from tenants.settings (falls back to global env constants)
    const [tenantRows] = await pool.query(
      'SELECT settings FROM tenants WHERE id = ? AND deleted_at IS NULL',
      [payment.tenant_id]
    );
    const rawSettings = tenantRows[0]?.settings;
    const tenantSettings = rawSettings
      ? (typeof rawSettings === 'object' ? rawSettings : (() => { try { return JSON.parse(rawSettings); } catch { return {}; } })())
      : {};
    const orgWebhookUrl = tenantSettings.notification_url || ORG_NOTIFICATION_URL || updated.callback_url || '';
    const outboundSecret = tenantSettings.webhook_secret || WEBHOOK_SECRET;

    // Push outbound notification to org's webhook endpoint (fire-and-forget, non-blocking)
    if (orgWebhookUrl) {
      const notificationPayload = {
        application_id: updated.application_id,
        status: updated.status,
        transaction_id: updated.transaction_id || null,
        paid_at: updated.paid_at || null,
      };
      const outboundSig = crypto
        .createHmac('sha256', outboundSecret)
        .update(JSON.stringify(notificationPayload))
        .digest('hex');
      fetch(orgWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': outboundSig },
        body: JSON.stringify(notificationPayload),
        signal: AbortSignal.timeout(8000),
      })
        .then((res) => {
          logger.info(`Org webhook push → ${orgWebhookUrl} | status=${res.status} | application_id=${updated.application_id}`);
        })
        .catch((err) => {
          logger.warn(`Org webhook push failed → ${orgWebhookUrl} | ${err.message}`);
        });
    }

    // Record notification log
    await pool.query(
      'INSERT INTO org_payment_notifications (id, tenant_id, application_id, payment_id, bill_id, status) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), payment.tenant_id, payment.application_id, payment.id, payment.bill_id, callback.status]
    );

    await auditLog(req, 'callback', 'org_payment', payment.id, `Callback: ${callback.status} via TXN ${callback.transactionId}`);

    const response = {
      data: {
        acknowledged: true,
        payment: updated,
        message: `Callback processed. Payment marked ${updated.status}`,
      },
    };
    await storeIdempotency(response);

    res.json(response);
  } catch (err) {
    next(err);
  }
};

// ---- GET /api/health ----
const healthCheck = async (req, res) => {
  res.json({
    data: {
      status: 'ok',
      service: 'org-payment-controller',
      timestamp: new Date().toISOString(),
    },
  });
};

// ---- Expire overdue payments (cron-callable) ----
const expireOverduePayments = async (req, res, next) => {
  try {
    // Fetch records about to be expired so we can log notifications
    const [toExpire] = await pool.query(
      `SELECT id, tenant_id, application_id, bill_id FROM org_payment_records
       WHERE status = 'pending' AND expiry_date <= UTC_TIMESTAMP()`
    );

    if (toExpire.length > 0) {
      await pool.query(
        `UPDATE org_payment_records SET status = 'expired'
         WHERE status = 'pending' AND expiry_date <= UTC_TIMESTAMP()`
      );

      // Insert a notification row for each expired record
      const notifValues = toExpire.map((r) => [uuidv4(), r.tenant_id, r.application_id, r.id, r.bill_id, 'expired']);
      await pool.query(
        'INSERT INTO org_payment_notifications (id, tenant_id, application_id, payment_id, bill_id, status) VALUES ?',
        [notifValues]
      );
    }

    res.json({
      data: { expiredCount: toExpire.length },
      message: `${toExpire.length} payment(s) expired`,
    });
  } catch (err) {
    next(err);
  }
};

// ---- GET /api/org/stats ----
const getStats = async (req, res, next) => {
  try {
    const params = [];
    let where = 'WHERE 1=1';
    if (req.tenantId) { where += ' AND tenant_id = ?'; params.push(req.tenantId); }

    // Status counts + totals in one query
    const [statusRows] = await pool.query(
      `SELECT status, COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS total
       FROM org_payment_records ${where}
       GROUP BY status`,
      params
    );

    const statusMap = {};
    statusRows.forEach((r) => { statusMap[r.status] = { count: Number(r.cnt), total: parseFloat(r.total) }; });

    const pending   = statusMap.pending   || { count: 0, total: 0 };
    const paid      = statusMap.paid      || { count: 0, total: 0 };
    const expired   = statusMap.expired   || { count: 0, total: 0 };
    const failed    = statusMap.failed    || { count: 0, total: 0 };

    // Verified transactions (paid + has transaction_id)
    const [vRows] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM org_payment_records ${where} AND status = 'paid' AND transaction_id IS NOT NULL`,
      params
    );
    const verifiedTransactions = Number(vRows[0].cnt);

    // Monthly collection trend (last 12 months)
    const trendParams = [...params];
    const [trendRows] = await pool.query(
      `SELECT DATE_FORMAT(paid_at, '%Y-%m') AS month, SUM(amount) AS revenue
       FROM org_payment_records
       ${where} AND status = 'paid' AND paid_at IS NOT NULL
         AND paid_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY month ORDER BY month ASC`,
      trendParams
    );

    const collectionTrend = trendRows.map((r) => {
      const [year, mo] = (r.month || '').split('-').map(Number);
      const label = new Date(year, mo - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      return { month: label, revenue: parseFloat(r.revenue) };
    });

    res.json({
      data: {
        totalRequests: pending.count + paid.count + expired.count + failed.count,
        pending:    pending.count,
        paid:       paid.count,
        expired:    expired.count,
        failed:     failed.count,
        feeCollected:          paid.total,
        verifiedTransactions,
        collectionTrend,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ---- List all payments & notifications ----
const listPayments = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params = [];
    if (req.tenantId) { where += ' AND tenant_id = ?'; params.push(req.tenantId); }
    if (req.query.status) { where += ' AND status = ?'; params.push(req.query.status); }
    if (req.query.from)   { where += ' AND created_at >= ?'; params.push(req.query.from); }
    if (req.query.to)     { where += ' AND created_at <= ?'; params.push(req.query.to); }
    if (req.query.application_id) { where += ' AND application_id = ?'; params.push(req.query.application_id); }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM org_payment_records ${where}`, params
    );

    const [rows] = await pool.query(
      `SELECT application_id, applicant_id, posting_id, consumer_number, amount, status,
              created_at, paid_at, transaction_id, expiry_date
       FROM org_payment_records ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      data: rows,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

const listNotifications = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params = [];
    if (req.tenantId) { where += ' AND tenant_id = ?'; params.push(req.tenantId); }
    if (req.query.status) { where += ' AND status = ?'; params.push(req.query.status); }
    if (req.query.from)   { where += ' AND sent_at >= ?'; params.push(req.query.from); }
    if (req.query.to)     { where += ' AND sent_at <= ?'; params.push(req.query.to); }
    if (req.query.application_id) { where += ' AND application_id = ?'; params.push(req.query.application_id); }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM org_payment_notifications ${where}`, params
    );

    const [rows] = await pool.query(
      `SELECT application_id, status, sent_at
       FROM org_payment_notifications ${where} ORDER BY sent_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      data: rows,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

// ---- Helper ----
const buildOneBillPayload = (payment, customerName = 'Applicant') => {
  const expiryIso = payment.expiry_date
    ? String(payment.expiry_date).replace(' ', 'T') + (String(payment.expiry_date).includes('Z') ? '' : 'Z')
    : null;
  const neverExpires = expiryIso && new Date(expiryIso).getFullYear() >= 9999;
  return {
    applicationId: payment.application_id,
    consumerNumber: payment.consumer_number || null,
    amount: parseFloat(payment.amount),
    expires: neverExpires ? 'never' : expiryIso,
    neverExpires,
    customerName,
    description: payment.description || `Payment for application ${payment.application_id}`,
  };
};

module.exports = {
  createPayment,
  getPaymentStatus,
  processPaymentCallback,
  healthCheck,
  expireOverduePayments,
  getStats,
  listPayments,
  listNotifications,
  generateWebhookSignature,
};
