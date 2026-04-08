const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const config = require('../config');

const FINTECH_PREFIX = config.fintechPrefix || '123456';
const { pool } = require('../config/database');
const logger = require('../config/logger');
const { AppError } = require('../middleware/errorHandler');
const { auditLog } = require('../middleware/auditLog');

const CALLBACK_URL = config.etea.callbackUrl;
const WEBHOOK_SECRET = config.etea.webhookSecret;
const REQUIRE_WEBHOOK_SIGNATURE = config.etea.requireWebhookSignature;
const DEFAULT_EXPIRY_HOURS = config.etea.paymentExpiryHours;
const ALLOWED_IPS = config.etea.allowedIps;

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
  description: body.description?.trim(),
  customerName: (body.customerName || body.customer_name || body.applicantId || body.applicant_id || 'Applicant').trim(),
  amount: body.amount,
});

// ---- Assert security context ----
const assertSecurity = (req, options = {}) => {
  // Protocol check
  const protocol = req.protocol || (req.headers['x-forwarded-proto'] || 'http');
  if (config.nodeEnv === 'production' && protocol !== 'https') {
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

    // IP whitelist (external callers only, production only)
    if (ALLOWED_IPS.length > 0 && config.nodeEnv === 'production') {
      const ip = req.ip || req.connection?.remoteAddress;
      if (!ALLOWED_IPS.includes(ip)) {
        throw new AppError('Source IP not whitelisted', 403, 'IP_BLOCKED');
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

// ---- Expire stale payment ----
const ensurePaymentNotStale = async (payment) => {
  if (payment.status !== 'pending') return payment;
  if (new Date(payment.expiry_date).getTime() > Date.now()) return payment;

  await pool.query('UPDATE etea_payment_records SET status = ? WHERE id = ?', ['expired', payment.id]);
  return { ...payment, status: 'expired' };
};

// ---- POST /api/payments/create ----
const createPayment = async (req, res, next) => {
  try {
    assertSecurity(req);

    const normalized = normalizeCreateRequest(req.body);
    const tenantId = req.tenantId || req.body.tenantId;

    if (!normalized.applicantId) throw new AppError('applicant_id is required', 400);
    if (!normalized.applicationId) throw new AppError('application_id is required', 400);
    if (!normalized.postingId) throw new AppError('posting_id is required', 400);
    if (!normalized.dueDate) throw new AppError('due_date is required', 400);
    if (!normalized.amount || normalized.amount <= 0) throw new AppError('Amount must be > 0', 400);

    // Check for existing payment (idempotent)
    const [existingRows] = await pool.query(
      'SELECT * FROM etea_payment_records WHERE application_id = ? AND tenant_id = ?',
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
      const [postingRows] = await pool.query('SELECT title FROM etea_postings WHERE id = ? AND deleted_at IS NULL', [normalized.postingId]);
      description = postingRows.length > 0
        ? `${postingRows[0].title} application fee`
        : `Payment for application ${normalized.applicationId}`;
    }

    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const dueDate = new Date(normalized.dueDate).toISOString().slice(0, 10);
    const expiryDate = addHours(createdAt, DEFAULT_EXPIRY_HOURS);
    const billId = `ETEA-${id.split('-')[0].toUpperCase()}`;

    // Generate a 1BILL-compatible consumer number for this payment record.
    // Format: FINTECH_PREFIX(6) + tenant biller_code(4) + zero-padded sequence(14) = 24 chars.
    let consumerNumber = null;
    try {
      const [tenantRows] = await pool.query('SELECT biller_code FROM tenants WHERE id = ?', [tenantId]);
      const billerCode = tenantRows[0]?.biller_code || '0000';
      const [seqRows] = await pool.query(
        'SELECT COUNT(*) AS cnt FROM etea_payment_records WHERE tenant_id = ?',
        [tenantId]
      );
      const seq = (seqRows[0]?.cnt || 0) + 1;
      consumerNumber = `${FINTECH_PREFIX}${billerCode}${String(seq).padStart(14, '0')}`;
    } catch (e) {
      logger.warn('Could not generate consumer number for ETEA payment:', e.message);
    }

    await pool.query(
      `INSERT INTO etea_payment_records (id, tenant_id, application_id, applicant_id, posting_id, bill_id, consumer_number, amount, status, due_date, expiry_date, created_at, description, callback_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
      [id, tenantId, normalized.applicationId, normalized.applicantId, normalized.postingId, billId, consumerNumber,
        normalized.amount, dueDate, expiryDate, createdAt, description, CALLBACK_URL]
    );

    const [rows] = await pool.query('SELECT * FROM etea_payment_records WHERE id = ?', [id]);
    const payment = rows[0];

    await auditLog(req, 'create', 'etea_payment', id, `Payment created for app ${normalized.applicationId}`);

    // Record notification
    await pool.query(
      'INSERT INTO etea_payment_notifications (id, tenant_id, application_id, payment_id, bill_id, status) VALUES (?, ?, ?, ?, ?, ?)',
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
    assertSecurity(req);

    const { applicationId } = req.params;

    const [rows] = await pool.query(
      'SELECT * FROM etea_payment_records WHERE application_id = ?',
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
    assertSecurity(req, { requireWebhookSignature: true, callback });

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
      'SELECT * FROM etea_payment_records WHERE bill_id = ?',
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
        'SELECT id FROM etea_payment_records WHERE transaction_id = ? AND bill_id != ?',
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
      updates.paid_at = callback.paidAt || new Date().toISOString();
    }

    await pool.query(
      'UPDATE etea_payment_records SET status = ?, transaction_id = ?, paid_at = ? WHERE id = ?',
      [updates.status, updates.transaction_id, updates.paid_at || null, payment.id]
    );

    // Record transaction in main transactions table
    if (callback.transactionId) {
      try {
        await pool.query(
          `INSERT INTO transactions (id, tenant_id, transaction_id, consumer_number, amount, status, date, biller_name, channel)
           VALUES (?, ?, ?, ?, ?, ?, CURDATE(), 'ETEA KPK', 'online')`,
          [uuidv4(), payment.tenant_id, callback.transactionId, payment.bill_id, payment.amount,
            callback.status === 'paid' ? 'completed' : callback.status === 'failed' ? 'failed' : 'pending']
        );
      } catch (e) {
        // Duplicate transaction - ignore
      }
    }

    // Record notification
    await pool.query(
      'INSERT INTO etea_payment_notifications (id, tenant_id, application_id, payment_id, bill_id, status) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), payment.tenant_id, payment.application_id, payment.id, payment.bill_id, callback.status]
    );

    const [updatedRows] = await pool.query('SELECT * FROM etea_payment_records WHERE id = ?', [payment.id]);
    const updated = updatedRows[0];

    await auditLog(req, 'callback', 'etea_payment', payment.id, `Callback: ${callback.status} via TXN ${callback.transactionId}`);

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
      service: 'etea-payment-controller',
      timestamp: new Date().toISOString(),
    },
  });
};

// ---- Expire overdue payments (cron-callable) ----
const expireOverduePayments = async (req, res, next) => {
  try {
    const [result] = await pool.query(
      `UPDATE etea_payment_records SET status = 'expired'
       WHERE status = 'pending' AND expiry_date <= NOW()`
    );
    res.json({
      data: { expiredCount: result.affectedRows },
      message: `${result.affectedRows} payment(s) expired`,
    });
  } catch (err) {
    next(err);
  }
};

// ---- List all payments & notifications ----
const listPayments = async (req, res, next) => {
  try {
    let where = 'WHERE 1=1';
    const params = [];
    if (req.tenantId) { where += ' AND tenant_id = ?'; params.push(req.tenantId); }

    const [rows] = await pool.query(`SELECT * FROM etea_payment_records ${where} ORDER BY created_at DESC`, params);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const listNotifications = async (req, res, next) => {
  try {
    let where = 'WHERE 1=1';
    const params = [];
    if (req.tenantId) { where += ' AND tenant_id = ?'; params.push(req.tenantId); }

    const [rows] = await pool.query(`SELECT * FROM etea_payment_notifications ${where} ORDER BY sent_at DESC`, params);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

// ---- Helper ----
const buildOneBillPayload = (payment, customerName = 'Applicant') => ({
  billId: payment.bill_id,
  amount: parseFloat(payment.amount),
  dueDate: payment.due_date,
  customerName,
  callbackUrl: payment.callback_url,
  description: payment.description || `Payment for application ${payment.application_id}`,
});

module.exports = {
  createPayment,
  getPaymentStatus,
  processPaymentCallback,
  healthCheck,
  expireOverduePayments,
  listPayments,
  listNotifications,
  generateWebhookSignature,
};
