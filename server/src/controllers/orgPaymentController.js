const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const config = require('../config');

const { pool } = require('../config/database');
const logger = require('../config/logger');
const { AppError } = require('../middleware/errorHandler');
const { auditLog } = require('../middleware/auditLog');
const { allocateConsumerNumber } = require('../services/consumerNumberService');
const { postPayment } = require('../services/paymentPostingService');

const CALLBACK_URL = config.org.callbackUrl;
const WEBHOOK_SECRET = config.org.webhookSecret;
const REQUIRE_WEBHOOK_SIGNATURE = config.org.requireWebhookSignature;
const DEFAULT_EXPIRY_HOURS = config.org.paymentExpiryHours;

// ---- Signature helpers ----
// HMAC-SHA256 over canonical payload: billId|status|transactionId|paidAt
const generateWebhookSignature = (callback) => {
  const paidAt = callback.paidAt || '';
  const payload = `${callback.billId}|${callback.status}|${callback.transactionId}|${paidAt}`;
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
};

const addHours = (date, hours) => {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
};

const parseBoolean = (value) => value === true || value === 1 || String(value).toLowerCase() === 'true';

const normalizeCreateRequest = (body) => ({
  applicantId: (body.applicantId || body.applicant_id || '').trim(),
  applicationId: (body.applicationId || body.application_id || '').trim(),
  postingId: (body.postingId || body.posting_id || '').trim(),
  dueDate: (body.dueDate || body.due_date || '').trim(),
  expireAt: body.expireAt || body.expire_at || null,
  neverExpires: parseBoolean(body.neverExpires ?? body.never_expires),
  description: body.description?.trim(),
  customerName: (body.customerName || body.customer_name || '').trim(),
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
        `SELECT value FROM settings
         WHERE tenant_id = ? AND \`key\` IN ('org_security_context', 'etea_security_context')
         ORDER BY \`key\` = 'org_security_context' DESC LIMIT 1`,
        [req.tenantId]
      );
      let setting = {};
      if (settingRows.length > 0) {
        const rawValue = settingRows[0].value;
        if (rawValue && typeof rawValue === 'object') setting = rawValue;
        else try { setting = JSON.parse(rawValue); } catch { /* handled below */ }
      }
      const rawIps = setting.sourceIp;
      const allowedIps = (Array.isArray(rawIps) ? rawIps : String(rawIps || '').split(','))
        .map((ip) => ip.trim().replace(/^::ffff:/, ''))
        .filter(Boolean);
      if (config.nodeEnv === 'production' && allowedIps.length === 0) {
        throw new AppError('Source IP allowlist is not configured', 503, 'IP_ALLOWLIST_REQUIRED');
      }
      if (allowedIps.length > 0) {
        const raw = req.ip || req.connection?.remoteAddress || '';
        const ip = raw.replace(/^::ffff:/, '');
        if (!allowedIps.includes(ip)) {
          logger.warn(`IP_BLOCKED: incoming="${ip}"`);
          throw new AppError('Source IP not whitelisted', 403, 'IP_BLOCKED');
        }
      }
    }
  }

  // Webhook signature validation (only for callbacks)
  if (options.requireWebhookSignature && options.callback && REQUIRE_WEBHOOK_SIGNATURE) {
    const expected = generateWebhookSignature(options.callback);
    const provided = req.headers['x-webhook-signature'];
    const providedBuffer = Buffer.from(String(provided || ''));
    const expectedBuffer = Buffer.from(expected);
    if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
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
const ensurePaymentNotStale = async (payment, executor = pool) => {
  if (payment.status !== 'pending') return payment;
  if (parseDbDate(payment.expiry_date).getTime() > Date.now()) return payment;

  await executor.query(
    'UPDATE org_payment_records SET status = ? WHERE id = ? AND tenant_id = ?',
    ['expired', payment.id, payment.tenant_id]
  );
  return { ...payment, status: 'expired' };
};

// ---- POST /api/payments/create ----
const createPayment = async (req, res, next) => {
  let connection;
  try {
    await assertSecurity(req);

    const normalized = normalizeCreateRequest(req.body);
    const tenantId = req.tenantId || req.body.tenantId;

    if (!normalized.applicantId) throw new AppError('applicant_id is required', 400);
    if (!normalized.applicationId) throw new AppError('application_id is required', 400);
    if (!normalized.postingId) throw new AppError('posting_id is required', 400);
    if (!normalized.customerName) throw new AppError('customer_name is required', 400, 'CUSTOMER_NAME_REQUIRED');
    if (!normalized.amount || normalized.amount <= 0) throw new AppError('Amount must be > 0', 400);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Tenant lock also serializes consumer-number allocation and lifecycle changes.
    const [tenantRows] = await connection.query(
      `SELECT id, status, lifecycle_stage FROM tenants
       WHERE id = ? AND deleted_at IS NULL FOR UPDATE`, [tenantId]
    );
    if (!tenantRows.length) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
    if (tenantRows[0].status !== 'active') throw new AppError('Tenant is suspended', 403, 'TENANT_SUSPENDED');
    if (config.appEnvironment !== 'sandbox' && tenantRows[0].lifecycle_stage !== 'live') {
      throw new AppError('Tenant has not been activated for production', 403, 'TENANT_NOT_LIVE');
    }

    const [existingRows] = await connection.query(
      'SELECT * FROM org_payment_records WHERE application_id = ? AND tenant_id = ? FOR UPDATE',
      [normalized.applicationId, tenantId]
    );

    if (existingRows.length > 0) {
      const existing = await ensurePaymentNotStale(existingRows[0], connection);
      await connection.commit();
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
      const [postingRows] = await connection.query(
        'SELECT title FROM org_postings WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL',
        [normalized.postingId, tenantId]
      );
      if (!postingRows.length) throw new AppError('Posting not found', 404, 'POSTING_NOT_FOUND');
      description = postingRows.length > 0
        ? `${postingRows[0].title} application fee`
        : `Payment for application ${normalized.applicationId}`;
    }

    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const createdAtDb = toMySQLDatetime(createdAt);
    // due_date: derive from expireAt date portion if provided, otherwise default to today+2
    const dueDate = normalized.dueDate
      ? new Date(normalized.dueDate).toISOString().slice(0, 10)
      : normalized.expireAt
        ? new Date(normalized.expireAt).toISOString().slice(0, 10)
        : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    // never_expires = store a far-future date (year 9999) so expiry queries never trigger
    const expiryDate = normalized.neverExpires
      ? '9999-12-31 23:59:59'
      : normalized.expireAt
        ? toMySQLDatetime(normalized.expireAt)
        : toMySQLDatetime(addHours(createdAt, DEFAULT_EXPIRY_HOURS));
    if (!expiryDate || !createdAtDb) throw new AppError('Invalid expiry date', 400, 'INVALID_EXPIRY_DATE');
    const billId = `ORG-${id.split('-')[0].toUpperCase()}`;

    const { consumerNumber } = await allocateConsumerNumber(connection, tenantId);

    await connection.query(
      `INSERT INTO org_payment_records (id, tenant_id, application_id, applicant_id, customer_name, posting_id, bill_id, consumer_number, amount, status, due_date, expiry_date, created_at, description, callback_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
      [id, tenantId, normalized.applicationId, normalized.applicantId, normalized.customerName, normalized.postingId, billId, consumerNumber,
        normalized.amount, dueDate, expiryDate, createdAtDb, description, CALLBACK_URL]
    );

    await connection.query(
      'INSERT INTO org_payment_notifications (id, tenant_id, application_id, payment_id, bill_id, status) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), tenantId, normalized.applicationId, id, billId, 'pending']
    );
    const [rows] = await connection.query('SELECT * FROM org_payment_records WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    const payment = rows[0];

    await connection.commit();

    await auditLog(req, 'create', 'org_payment', id, `Payment created for app ${normalized.applicationId}`);

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
    if (connection) await connection.rollback();
    next(err);
  } finally {
    if (connection) connection.release();
  }
};

// ---- GET /api/payments/:applicationId ----
const getPaymentStatus = async (req, res, next) => {
  try {
    await assertSecurity(req);

    const { applicationId } = req.params;

    const [rows] = await pool.query(
      'SELECT * FROM org_payment_records WHERE application_id = ? AND tenant_id = ?',
      [applicationId, req.tenantId]
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
       WHERE tenant_id = ? AND status = 'pending' AND expiry_date <= UTC_TIMESTAMP()`,
      [req.tenantId]
    );

    if (toExpire.length > 0) {
      await pool.query(
        `UPDATE org_payment_records SET status = 'expired'
         WHERE tenant_id = ? AND status = 'pending' AND expiry_date <= UTC_TIMESTAMP()`,
        [req.tenantId]
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

    // Monthly request/collection trend (last 12 months), aggregated in SQL so
    // dashboards never download an unbounded payment history.
    const trendParams = [...params];
    const [trendRows] = await pool.query(
      `SELECT DATE_FORMAT(COALESCE(paid_at, created_at), '%Y-%m') AS month,
              COUNT(*) AS requests,
              COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS revenue,
              SUM(status IN ('failed','expired')) AS failed
       FROM org_payment_records
       ${where} AND COALESCE(paid_at, created_at) >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 12 MONTH)
       GROUP BY month ORDER BY month ASC`,
      trendParams
    );

    const collectionTrend = trendRows.map((r) => {
      const [year, mo] = (r.month || '').split('-').map(Number);
      const label = new Date(year, mo - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      return { month: label, revenue: parseFloat(r.revenue), requests: Number(r.requests), failed: Number(r.failed) };
    });

    const [postingRows] = await pool.query(
      `SELECT opr.posting_id, COALESCE(op.title, opr.posting_id) AS posting,
              COUNT(*) AS total_requests,
              SUM(opr.status = 'paid') AS paid_requests,
              SUM(opr.status = 'pending') AS pending_requests,
              SUM(opr.status IN ('failed','expired')) AS failed_requests,
              COALESCE(SUM(CASE WHEN opr.status = 'paid' THEN opr.amount ELSE 0 END), 0) AS collected
       FROM org_payment_records opr
       LEFT JOIN org_postings op ON op.id = opr.posting_id AND op.tenant_id = opr.tenant_id
       ${where.replaceAll('tenant_id', 'opr.tenant_id')}
       GROUP BY opr.posting_id, op.title
       ORDER BY collected DESC`,
      params
    );
    const postingRevenue = postingRows.map((row) => ({
      postingId: row.posting_id,
      posting: row.posting,
      totalRequests: Number(row.total_requests),
      paidRequests: Number(row.paid_requests),
      pendingRequests: Number(row.pending_requests),
      failedRequests: Number(row.failed_requests),
      collected: Number(row.collected),
      avgAmount: Number(row.paid_requests) > 0 ? Number(row.collected) / Number(row.paid_requests) : 0,
    }));

    const [[today]] = await pool.query(
      `SELECT COUNT(*) AS paid_count, COALESCE(SUM(amount), 0) AS collected
       FROM org_payment_records ${where}
       AND status = 'paid' AND paid_at >= UTC_DATE() AND paid_at < UTC_DATE() + INTERVAL 1 DAY`,
      params
    );

    res.json({
      data: {
        totalRequests: pending.count + paid.count + expired.count + failed.count,
        pending:    pending.count,
        pendingValue: pending.total,
        paid:       paid.count,
        expired:    expired.count,
        failed:     failed.count,
        feeCollected:          paid.total,
        verifiedTransactions,
        collectionTrend,
        postingRevenue,
        todayPaidCount: Number(today.paid_count),
        todayCollected: Number(today.collected),
        statusDistribution: Object.fromEntries(Object.entries(statusMap).map(([status, value]) => [status, value.count])),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ---- List all payments & notifications ----
const listPayments = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || req.query.pageSize, 10) || 30, 1), 30);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params = [];
    if (req.tenantId) { where += ' AND opr.tenant_id = ?'; params.push(req.tenantId); }
    if (req.query.status === 'overdue') where += " AND opr.status IN ('failed','expired')";
    else if (req.query.status) { where += ' AND opr.status = ?'; params.push(req.query.status); }
    if (req.query.from)   { where += ' AND opr.created_at >= ?'; params.push(req.query.from); }
    if (req.query.to)     { where += ' AND opr.created_at <= ?'; params.push(req.query.to); }
    if (req.query.application_id) { where += ' AND opr.application_id = ?'; params.push(req.query.application_id); }
    if (req.query.search) {
      where += ` AND (opr.application_id LIKE ? OR opr.applicant_id LIKE ? OR opr.posting_id LIKE ?
                 OR opr.consumer_number LIKE ? OR opr.transaction_id LIKE ? OR opr.bill_id LIKE ?)`;
      const search = `%${String(req.query.search).slice(0, 100)}%`;
      params.push(search, search, search, search, search, search);
    }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM org_payment_records opr ${where}`, params
    );

    const [rows] = await pool.query(
      `SELECT opr.id, opr.application_id, opr.applicant_id, opr.customer_name, opr.posting_id, opr.bill_id,
              opr.consumer_number, opr.amount, opr.status, opr.due_date, opr.expiry_date,
              opr.created_at, opr.paid_at, opr.transaction_id, opr.description, opr.callback_url,
              p.id AS posted_payment_id, p.source AS payment_source,
              p.receipt_number AS payment_receipt_number
       FROM org_payment_records opr
       LEFT JOIN payment_allocations pa ON pa.target_type = 'org_payment' AND pa.target_id = opr.id
       LEFT JOIN payments p ON p.id = pa.payment_id AND p.tenant_id = opr.tenant_id
       ${where}
       ORDER BY opr.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      data: rows,
      meta: { total: Number(total), page, pageSize: limit, pages: Math.ceil(Number(total) / limit) },
    });
  } catch (err) {
    next(err);
  }
};

const listNotifications = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || req.query.pageSize, 10) || 30, 1), 30);
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
      meta: { total: Number(total), page, pageSize: limit, pages: Math.ceil(Number(total) / limit) },
    });
  } catch (err) {
    next(err);
  }
};

// ---- Helper ----
const buildOneBillPayload = (payment, customerName = payment.customer_name || 'Applicant') => {
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

const processPaymentCallbackCanonical = async (req, res, next) => {
  try {
    const callback = req.body;
    await assertSecurity(req, { requireWebhookSignature: true, callback });
    const [rows] = await pool.query(
      `SELECT * FROM org_payment_records WHERE bill_id = ? AND tenant_id = ? LIMIT 1`,
      [callback.billId, req.tenantId]
    );
    if (!rows.length) return res.status(404).json({ data: { acknowledged: false, message: 'Bill not found' } });
    const record = rows[0];
    if (callback.status === 'paid') {
      if (record.status === 'paid') {
        return res.json({ data: { acknowledged: true, payment: record, message: 'Duplicate callback ignored' } });
      }
      const result = await postPayment({
        tenantId: req.tenantId, targetType: 'org_payment', orgPaymentId: record.id,
        consumerNumber: record.consumer_number, amount: Number(record.amount),
        receivedAt: callback.paidAt || new Date(), channel: 'org_callback',
        externalReference: callback.transactionId, transactionId: callback.transactionId,
        idempotencyKey: req.headers['x-idempotency-key'] || callback.transactionId,
        note: 'Verified organization payment callback', source: 'org_callback',
        actorName: 'Organization callback', ipAddress: req.ip, userAgent: req.headers['user-agent'],
      });
      return res.json({ data: { acknowledged: true, payment: result, message: 'Callback payment posted' } });
    }
    if (record.status === 'paid') {
      throw new AppError('A posted payment cannot be overwritten by a failure callback', 409, 'PAYMENT_IMMUTABLE');
    }
    await pool.query(
      `UPDATE org_payment_records SET status = ?, transaction_id = ?
       WHERE id = ? AND tenant_id = ? AND status = 'pending'`,
      [callback.status, callback.transactionId, record.id, req.tenantId]
    );
    await auditLog(req, 'callback', 'org_payment', record.id, `Callback marked ${callback.status}`);
    return res.json({ data: { acknowledged: true, message: `Callback processed: ${callback.status}` } });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createPayment,
  getPaymentStatus,
  processPaymentCallback: processPaymentCallbackCanonical,
  healthCheck,
  expireOverduePayments,
  getStats,
  listPayments,
  listNotifications,
  generateWebhookSignature,
};
