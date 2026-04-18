/**
 * saasGateway.js — External SaaS Payment Gateway APIs
 *
 * Mounted at: /api/saas/v1
 *
 * Authentication: X-API-Key header containing the PCID's api_key value.
 * Each PCID (1LINK biller code) has a unique api_key generated in Bundle Management.
 * A PCID can optionally be linked to a biller (tenant); if linked, all queries
 * are scoped to that biller's students only.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  API 1  POST /api/saas/v1/check-payment                                  │
 * │         Quick boolean: has this consumer number paid their latest bill?   │
 * │                                                                          │
 * │  API 2  GET  /api/saas/v1/bill-status/:consumerNumber                    │
 * │         Full financial snapshot: totals, pending & overdue amounts, etc. │
 * │                                                                          │
 * │  API 3  GET  /api/saas/v1/payment-history/:consumerNumber                │
 * │         Paginated list of all payment ledger entries.                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const logger = require('../config/logger');
const config = require('../config');

const FINTECH_PREFIX = config.fintechPrefix || '123456';
const generateConsumerNumber = (billerCode, seq) =>
  `${FINTECH_PREFIX}${billerCode}${String(seq).padStart(14, '0')}`;

// ── API-key authentication middleware ────────────────────────────────────────

const apiKeyAuth = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({
      error: 'Missing X-API-Key header',
      code: 'MISSING_API_KEY',
    });
  }

  try {
    const [rows] = await pool.query(
      `SELECT bp.pcid, bp.biller_id, t.status AS tenant_status
       FROM bundle_pcids bp
       LEFT JOIN tenants t ON t.id = bp.biller_id
       WHERE bp.api_key = ? LIMIT 1`,
      [apiKey]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key', code: 'INVALID_API_KEY' });
    }
    if (rows[0].biller_id && rows[0].tenant_status && rows[0].tenant_status !== 'active') {
      return res.status(403).json({ error: 'Linked biller account is suspended', code: 'TENANT_SUSPENDED' });
    }
    if (!rows[0].biller_id) {
      return res.status(403).json({
        error: 'This PCID is not linked to a biller yet. Go to Bundle Management → link a biller to this PCID.',
        code: 'PCID_NOT_LINKED',
      });
    }

    req.saasTenantId = rows[0].biller_id;
    req.saasPcid = rows[0].pcid;
    next();
  } catch (err) {
    logger.error('SaaS API key auth error:', err);
    next(err);
  }
};

router.use(apiKeyAuth);

router.use(apiKeyAuth);

// ── API 1: POST /api/saas/v1/check-payment ───────────────────────────────────
/**
 * Check whether a consumer has paid their most recent invoice.
 *
 * Request body: { "consumerNumber": "1234567890" }
 *
 * Response:
 * {
 *   "paid": true,
 *   "status": "paid",           // paid | pending | overdue | no_invoices | not_found
 *   "consumerNumber": "...",
 *   "studentName": "...",
 *   "invoiceNumber": "...",
 *   "amount": 1800,
 *   "dueDate": "2026-04-30",
 *   "lastPayment": { "amount": 1800, "paidAt": "2026-04-12T...", "transactionId": "..." }
 * }
 */
router.post('/check-payment', async (req, res, next) => {
  try {
    const { consumerNumber } = req.body;
    if (!consumerNumber) {
      return res.status(400).json({ error: 'consumerNumber is required', code: 'MISSING_PARAM' });
    }

    const [students] = await pool.query(
      `SELECT id, name FROM students
       WHERE consumer_number = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1`,
      [consumerNumber, req.saasTenantId]
    );

    if (students.length === 0) {
      return res.json({
        paid: false,
        status: 'not_found',
        consumerNumber,
        message: 'Consumer not registered under this account',
      });
    }

    const student = students[0];

    // Latest invoice by due date
    const [invoices] = await pool.query(
      `SELECT id, invoice_number, amount, status, due_date
       FROM invoices
       WHERE student_id = ? AND deleted_at IS NULL
       ORDER BY due_date DESC, created_at DESC LIMIT 1`,
      [student.id]
    );

    if (invoices.length === 0) {
      return res.json({
        paid: true,
        status: 'no_invoices',
        consumerNumber,
        name: student.name,
        message: 'No invoices on file — account is clear',
      });
    }

    const invoice = invoices[0];

    // Most recent payment ledger entry
    const [payments] = await pool.query(
      `SELECT credit AS amount, created_at AS paidAt, reference AS transactionId
       FROM ledger_entries
       WHERE student_id = ? AND entry_type = 'payment'
       ORDER BY created_at DESC LIMIT 1`,
      [student.id]
    );

    return res.json({
      paid: invoice.status === 'paid',
      status: invoice.status,
      consumerNumber,
      name: student.name,
      invoiceNumber: invoice.invoice_number,
      amount: Number(invoice.amount),
      dueDate: invoice.due_date,
      lastPayment: payments.length > 0
        ? { amount: Number(payments[0].amount), paidAt: payments[0].paidAt, transactionId: payments[0].transactionId }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

// ── API 2: GET /api/saas/v1/bill-status/:consumerNumber ──────────────────────
/**
 * Full financial snapshot for a consumer.
 *
 * Response:
 * {
 *   "consumerNumber": "...",
 *   "studentName": "...",
 *   "class": "Class 9",
 *   "section": "A",
 *   "accountStatus": "active",
 *   "paymentStatus": "paid_up" | "due" | "overdue",
 *   "totalDue": 3600,
 *   "totalPaid": 18000,
 *   "pendingAmount": 1800,
 *   "overdueAmount": 1800,
 *   "pendingInvoices": 1,
 *   "overdueInvoices": 1,
 *   "lastPaymentDate": "2026-03-10T..."
 * }
 */
router.get('/bill-status/:consumerNumber', async (req, res, next) => {
  try {
    const { consumerNumber } = req.params;

    const [students] = await pool.query(
      `SELECT id, name, status
       FROM students
       WHERE consumer_number = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1`,
      [consumerNumber, req.saasTenantId]
    );

    if (students.length === 0) {
      return res.status(404).json({ error: 'Consumer not found', code: 'NOT_FOUND' });
    }

    const student = students[0];

    // Aggregate invoice totals by status
    const [invoiceSummary] = await pool.query(
      `SELECT status,
              SUM(amount) AS total,
              COUNT(*)    AS count
       FROM invoices
       WHERE student_id = ? AND deleted_at IS NULL
       GROUP BY status`,
      [student.id]
    );

    const summary = { pending: 0, paid: 0, overdue: 0, pendingCount: 0, overdueCount: 0 };
    for (const row of invoiceSummary) {
      if (row.status === 'paid')    { summary.paid    = Number(row.total); }
      if (row.status === 'pending') { summary.pending = Number(row.total); summary.pendingCount = row.count; }
      if (row.status === 'overdue') { summary.overdue = Number(row.total); summary.overdueCount = row.count; }
    }

    const [lastPaymentRows] = await pool.query(
      `SELECT created_at FROM ledger_entries
       WHERE student_id = ? AND entry_type = 'payment'
       ORDER BY created_at DESC LIMIT 1`,
      [student.id]
    );

    const totalDue = summary.pending + summary.overdue;
    const paymentStatus =
      totalDue === 0 ? 'paid_up' :
      summary.overdue > 0 ? 'overdue' :
      'due';

    return res.json({
      consumerNumber,
      name: student.name,
      accountStatus: student.status,
      paymentStatus,
      totalDue,
      totalPaid: summary.paid,
      pendingAmount: summary.pending,
      overdueAmount: summary.overdue,
      pendingInvoices: summary.pendingCount,
      overdueInvoices: summary.overdueCount,
      lastPaymentDate: lastPaymentRows.length > 0 ? lastPaymentRows[0].created_at : null,
    });
  } catch (err) {
    next(err);
  }
});

// ── API 3: GET /api/saas/v1/payment-history/:consumerNumber ──────────────────
/**
 * Paginated list of all payment ledger entries for a consumer.
 *
 * Query params: page (default 1), pageSize (default 20, max 100)
 *
 * Response:
 * {
 *   "consumerNumber": "...",
 *   "studentName": "...",
 *   "data": [
 *     { "id": "...", "date": "2026-04-12", "amount": 1800, "balance": 0,
 *       "description": "Payment received", "reference": "TXN123", "createdAt": "..." }
 *   ],
 *   "meta": { "page": 1, "pageSize": 20, "total": 5 }
 * }
 */
router.get('/payment-history/:consumerNumber', async (req, res, next) => {
  try {
    const { consumerNumber } = req.params;
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)));
    const offset = (page - 1) * pageSize;

    const [students] = await pool.query(
      `SELECT id, name FROM students
       WHERE consumer_number = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1`,
      [consumerNumber, req.saasTenantId]
    );

    if (students.length === 0) {
      return res.status(404).json({ error: 'Consumer not found', code: 'NOT_FOUND' });
    }

    const student = students[0];

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM ledger_entries
       WHERE student_id = ? AND entry_type = 'payment'`,
      [student.id]
    );

    const [rows] = await pool.query(
      `SELECT id, date, description, credit AS amount, balance, reference, created_at AS createdAt
       FROM ledger_entries
       WHERE student_id = ? AND entry_type = 'payment'
       ORDER BY date DESC, created_at DESC
       LIMIT ? OFFSET ?`,
      [student.id, pageSize, offset]
    );

    return res.json({
      consumerNumber,
      name: student.name,
      data: rows.map((r) => ({
        id: r.id,
        date: r.date,
        amount: Number(r.amount),
        balance: Number(r.balance),
        description: r.description,
        reference: r.reference,
        createdAt: r.createdAt,
      })),
      meta: { page, pageSize, total: countRows[0].total },
    });
  } catch (err) {
    next(err);
  }
});

// ── API 4: POST /api/saas/v1/make-payment ───────────────────────────────────
/**
 * Post a payment for a consumer and automatically apply it to their oldest
 * unpaid invoices in order. Returns a receipt.
 *
 * Request body: { "consumerNumber": "...", "amount": 1800, "reference": "TXN123", "channel": "online" }
 *
 * Response:
 * {
 *   "receiptNumber": "RCPT-1712345678",
 *   "transactionId": "TXN123",
 *   "status": "paid" | "partial",
 *   "consumerNumber": "...",
 *   "studentName": "...",
 *   "amount": 1800,
 *   "remainingBalance": 0,
 *   "paidAt": "2026-04-13",
 *   "channel": "online"
 * }
 */
router.post('/make-payment', async (req, res, next) => {
  try {
    const { consumerNumber, amount, reference, channel = 'saas_gateway' } = req.body;

    if (!consumerNumber) {
      return res.status(400).json({ error: 'consumerNumber is required', code: 'MISSING_PARAM' });
    }
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number', code: 'INVALID_AMOUNT' });
    }
    const amountFixed = parseFloat(parsedAmount.toFixed(2));
    const paidAt = new Date().toISOString().slice(0, 10);
    const transactionId = (reference || '').trim() || `SAAS-${Date.now()}`;

    const [students] = await pool.query(
      `SELECT id, name, tenant_id FROM students
       WHERE consumer_number = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1`,
      [consumerNumber, req.saasTenantId]
    );

    if (students.length === 0) {
      return res.status(404).json({ error: 'Consumer not found', code: 'NOT_FOUND' });
    }

    const student = students[0];
    const tenantId = student.tenant_id;

    // First unpaid invoice number for receipt reference
    const [firstUnpaid] = await pool.query(
      `SELECT invoice_number FROM invoices
       WHERE student_id = ? AND status != 'paid' AND deleted_at IS NULL
       ORDER BY due_date ASC LIMIT 1`,
      [student.id]
    );
    const invoiceRef = firstUnpaid[0]?.invoice_number || null;

    // Insert payment record
    const paymentId = uuidv4();
    const receiptNumber = `RCPT-${Date.now()}`;
    await pool.query(
      `INSERT INTO payments (id, tenant_id, student_id, consumer_number, amount, date, reference, channel, receipt_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [paymentId, tenantId, student.id, consumerNumber, amountFixed, paidAt, transactionId, channel, receiptNumber]
    );

    // Apply to invoices oldest-first
    const [unpaidInvoices] = await pool.query(
      `SELECT id, amount FROM invoices
       WHERE student_id = ? AND status != 'paid' AND deleted_at IS NULL
       ORDER BY due_date ASC`,
      [student.id]
    );

    let remaining = amountFixed;
    for (const inv of unpaidInvoices) {
      if (remaining <= 0) break;
      const invAmount = parseFloat(inv.amount);
      if (remaining >= invAmount) {
        await pool.query(`UPDATE invoices SET status = 'paid', paid_at = NOW() WHERE id = ?`, [inv.id]);
        remaining = parseFloat((remaining - invAmount).toFixed(2));
      } else {
        break; // partial — leave remaining invoices as-is
      }
    }

    // Ledger entry
    const [lastEntry] = await pool.query(
      `SELECT balance FROM ledger_entries WHERE student_id = ? ORDER BY date DESC, created_at DESC LIMIT 1`,
      [student.id]
    );
    let runningBalance = lastEntry.length ? parseFloat(lastEntry[0].balance) : 0;
    runningBalance = parseFloat((runningBalance - amountFixed).toFixed(2));
    if (runningBalance < 0) runningBalance = 0;

    await pool.query(
      `INSERT INTO ledger_entries (id, tenant_id, student_id, date, description, debit, credit, balance, bill_id, reference, entry_type)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'payment')`,
      [uuidv4(), tenantId, student.id, paidAt,
       `Payment received via ${channel}`, amountFixed, runningBalance, invoiceRef, transactionId]
    );

    // Remaining outstanding
    const [afterRows] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS still_due FROM invoices
       WHERE student_id = ? AND status != 'paid' AND deleted_at IS NULL`,
      [student.id]
    );
    const stillDue = parseFloat(afterRows[0].still_due);

    return res.status(201).json({
      receiptNumber,
      transactionId,
      status: stillDue === 0 ? 'paid' : 'partial',
      consumerNumber,
      name: student.name,
      amount: amountFixed,
      remainingBalance: stillDue,
      paidAt,
      channel,
    });
  } catch (err) {
    next(err);
  }
});

// ── API 5: POST /api/saas/v1/register-consumer ──────────────────────────────
/**
 * Register a new consumer under the linked biller and return a 1BILL-compliant
 * consumer number the app can give to the end-customer so they can pay via
 * ATM / mobile banking / bank branch.
 *
 * Request body:
 * {
 *   "name":        "Ahmed Khan",       // required
 *   "phone":       "03001234567",      // optional
 *   "email":       "a@example.com",   // optional — stored in address field
 *   "externalRef": "your-internal-id",// optional — stored in bill_id
 *   "bundleId":    "BUNDLE-001",       // optional — auto-creates an invoice
 *   "dueDate":     "2026-05-15"        // optional — invoice due date (YYYY-MM-DD, default 30 days)
 * }
 *
 * Response:
 * {
 *   "consumerNumber": "1234561001000000000001",
 *   "consumerId":     "uuid",
 *   "name":           "Ahmed Khan",
 *   "externalRef":    "your-internal-id",
 *   "tenantId":       "uuid",
 *   "invoice":        { "invoiceNumber": "...", "amount": 1500, "dueDate": "2026-05-15" } // only when bundleId given
 * }
 */
router.post('/register-consumer', async (req, res, next) => {
  try {
    const { name, phone, email, externalRef, bundleId, dueDate } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required', code: 'MISSING_PARAM' });
    }

    // Resolve tenant's biller_code
    const [tenants] = await pool.query(
      'SELECT id, biller_code FROM tenants WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [req.saasTenantId]
    );
    if (tenants.length === 0) {
      return res.status(404).json({ error: 'Linked biller not found', code: 'TENANT_NOT_FOUND' });
    }
    const { biller_code: billerCode } = tenants[0];
    const pcid = req.saasPcid || billerCode;

    // Validate bundleId if provided
    let bundleRow = null;
    if (bundleId) {
      const [bundleRows] = await pool.query(
        `SELECT * FROM bundles
         WHERE bundle_id = ? AND pcid = ? AND status = 'active' AND deleted_at IS NULL
         LIMIT 1`,
        [String(bundleId).trim(), pcid]
      );
      if (bundleRows.length === 0) {
        return res.status(400).json({ error: `Bundle '${bundleId}' not found or inactive for PCID '${pcid}'`, code: 'BUNDLE_NOT_FOUND' });
      }
      bundleRow = bundleRows[0];
    }

    // Generate next consumer number using count of ALL students (including deleted) to avoid reuse
    const [seqRows] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM students WHERE tenant_id = ?',
      [req.saasTenantId]
    );
    const seq = seqRows[0].cnt + 1;
    const consumerNumber = generateConsumerNumber(billerCode, seq);
    const billId = externalRef ? String(externalRef).slice(0, 50) : `GW-${billerCode}-${String(seq).padStart(5, '0')}`;
    const consumerId = uuidv4();

    await pool.query(
      `INSERT INTO students
         (id, tenant_id, name, phone, consumer_number, bill_id, status, balance, address)
       VALUES (?, ?, ?, ?, ?, ?, 'active', 0, ?)`,
      [
        consumerId,
        req.saasTenantId,
        name.trim(),
        phone?.trim() || null,
        consumerNumber,
        billId,
        email?.trim() || null,
      ]
    );

    // Auto-create invoice when bundleId provided
    let invoiceInfo = null;
    if (bundleRow) {
      const bundleAmount = parseFloat(bundleRow.amount);
      const now = new Date();
      let dueDateStr;
      if (dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        dueDateStr = dueDate;
      } else {
        dueDateStr = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      }
      const invoiceNumber = `INV-${billerCode}-${String(seq).padStart(6, '0')}`;

      await pool.query(
        `INSERT INTO invoices
           (id, tenant_id, invoice_number, student_id, student_name,
            consumer_number, month, amount, status, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          uuidv4(), req.saasTenantId, invoiceNumber,
          consumerId, name.trim(), consumerNumber,
          now.toISOString().slice(0, 7), bundleAmount, dueDateStr,
        ]
      );
      invoiceInfo = { invoiceNumber, amount: bundleAmount, dueDate: dueDateStr, bundleId: bundleRow.bundle_id, bundleName: bundleRow.bundle_name };
      logger.info(`SaaS register-consumer: created invoice ${invoiceNumber} for ${consumerNumber} bundle ${bundleRow.bundle_id} PKR ${bundleAmount}`);
    }

    return res.status(201).json({
      consumerNumber,
      consumerId,
      name: name.trim(),
      externalRef: billId,
      tenantId: req.saasTenantId,
      ...(invoiceInfo ? { invoice: invoiceInfo } : {}),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
