/** Tenant-scoped external billing APIs. FetchBundle/PCID coupling is retired. */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const config = require('../config');
const logger = require('../config/logger');
const { allocateConsumerNumber } = require('../services/consumerNumberService');
const { postPayment } = require('../services/paymentPostingService');
const { hashApiKey } = require('../services/apiKeyService');

const router = express.Router();
const expectedApiKeyScope = config.appEnvironment === 'sandbox' ? 'test' : 'live';

const apiKeyAuth = async (req, res, next) => {
  const apiKey = String(req.headers['x-api-key'] || '');
  if (!apiKey) return res.status(401).json({ error: 'Missing X-API-Key header', code: 'MISSING_API_KEY' });
  try {
    const [rows] = await pool.query(
      `SELECT id, name, status, lifecycle_stage FROM tenants
       WHERE api_key_hash = ? AND api_key_scope = ? AND deleted_at IS NULL LIMIT 1`,
      [hashApiKey(apiKey), expectedApiKeyScope]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid API key', code: 'INVALID_API_KEY' });
    const tenant = rows[0];
    if (tenant.status !== 'active') return res.status(403).json({ error: 'Biller is suspended', code: 'TENANT_SUSPENDED' });
    if (config.appEnvironment === 'production' && tenant.lifecycle_stage !== 'live') {
      return res.status(403).json({ error: 'Biller is not active in production', code: 'TENANT_NOT_LIVE' });
    }
    req.saasTenantId = tenant.id;
    req.saasTenant = tenant;
    next();
  } catch (err) {
    logger.error('SaaS API key auth error:', err);
    next(err);
  }
};

router.use(apiKeyAuth);

const findStudent = async (tenantId, consumerNumber) => {
  const [rows] = await pool.query(
    `SELECT id, name, class, consumer_number FROM students
     WHERE tenant_id = ? AND consumer_number = ? AND status = 'active'
       AND deleted_at IS NULL LIMIT 1`,
    [tenantId, consumerNumber]
  );
  return rows[0] || null;
};

router.post('/check-payment', async (req, res, next) => {
  try {
    const consumerNumber = String(req.body.consumerNumber || '').trim();
    if (!/^\d{1,24}$/.test(consumerNumber)) return res.status(400).json({ error: 'Valid consumerNumber is required', code: 'INVALID_PARAM' });
    const student = await findStudent(req.saasTenantId, consumerNumber);
    if (!student) return res.json({ paid: false, status: 'not_found', consumerNumber });
    const [invoices] = await pool.query(
      `SELECT invoice_number, amount, status, due_date FROM invoices
       WHERE tenant_id = ? AND student_id = ? AND deleted_at IS NULL
       ORDER BY due_date DESC, created_at DESC LIMIT 1`, [req.saasTenantId, student.id]
    );
    const invoice = invoices[0];
    if (!invoice) return res.json({ paid: true, status: 'no_invoices', consumerNumber, name: student.name });
    const [payments] = await pool.query(
      `SELECT amount, received_at AS paidAt, reference AS transactionId FROM payments
       WHERE tenant_id = ? AND student_id = ? AND status = 'posted'
       ORDER BY received_at DESC, created_at DESC LIMIT 1`, [req.saasTenantId, student.id]
    );
    res.json({ paid: invoice.status === 'paid', status: invoice.status, consumerNumber,
      name: student.name, invoiceNumber: invoice.invoice_number, amount: Number(invoice.amount),
      dueDate: invoice.due_date, lastPayment: payments[0] || null });
  } catch (err) { next(err); }
});

router.get('/bill-status/:consumerNumber', async (req, res, next) => {
  try {
    const consumerNumber = String(req.params.consumerNumber || '').trim();
    const student = await findStudent(req.saasTenantId, consumerNumber);
    if (!student) return res.status(404).json({ error: 'Consumer not found', code: 'NOT_FOUND' });
    const [[summary]] = await pool.query(
      `SELECT COUNT(*) AS totalInvoices, SUM(status = 'paid') AS paidInvoices,
              SUM(status != 'paid') AS pendingInvoices,
              COALESCE(SUM(CASE WHEN status != 'paid' THEN amount ELSE 0 END),0) AS outstandingAmount,
              COALESCE(SUM(CASE WHEN status != 'paid' AND due_date < CURDATE() THEN amount ELSE 0 END),0) AS overdueAmount
       FROM invoices WHERE tenant_id = ? AND student_id = ? AND deleted_at IS NULL`,
      [req.saasTenantId, student.id]
    );
    res.json({ consumerNumber, name: student.name, class: student.class,
      totalInvoices: Number(summary.totalInvoices), paidInvoices: Number(summary.paidInvoices),
      pendingInvoices: Number(summary.pendingInvoices), outstandingAmount: Number(summary.outstandingAmount),
      overdueAmount: Number(summary.overdueAmount) });
  } catch (err) { next(err); }
});

router.get('/payment-history/:consumerNumber', async (req, res, next) => {
  try {
    const consumerNumber = String(req.params.consumerNumber || '').trim();
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 25, 1), 100);
    const student = await findStudent(req.saasTenantId, consumerNumber);
    if (!student) return res.status(404).json({ error: 'Consumer not found', code: 'NOT_FOUND' });
    const [[count]] = await pool.query(
      "SELECT COUNT(*) AS total FROM payments WHERE tenant_id = ? AND student_id = ? AND status = 'posted'",
      [req.saasTenantId, student.id]
    );
    const [rows] = await pool.query(
      `SELECT receipt_number AS receiptNumber, amount, currency, received_at AS paidAt,
              reference AS transactionId, channel, source
       FROM payments WHERE tenant_id = ? AND student_id = ? AND status = 'posted'
       ORDER BY received_at DESC, created_at DESC LIMIT ? OFFSET ?`,
      [req.saasTenantId, student.id, pageSize, (page - 1) * pageSize]
    );
    res.json({ consumerNumber, name: student.name, payments: rows,
      pagination: { page, pageSize, total: Number(count.total), pages: Math.ceil(Number(count.total) / pageSize) } });
  } catch (err) { next(err); }
});

router.post('/make-payment', async (req, res, next) => {
  try {
    const reference = String(req.body.reference || '').trim();
    if (!reference) return res.status(400).json({ error: 'reference is required', code: 'REFERENCE_REQUIRED' });
    const result = await postPayment({
      tenantId: req.saasTenantId, targetType: 'invoice',
      consumerNumber: String(req.body.consumerNumber || '').trim(), amount: Number(req.body.amount),
      receivedAt: req.body.receivedAt || new Date(), channel: req.body.channel || 'saas_gateway',
      externalReference: reference, transactionId: reference,
      idempotencyKey: req.headers['x-idempotency-key'] || reference,
      note: req.body.note || 'Tenant API payment', source: 'saas_api', actorName: 'Tenant API',
      ipAddress: req.ip, userAgent: req.headers['user-agent'],
    });
    res.status(201).json(result);
  } catch (err) { next(err); }
});

router.post('/register-consumer', async (req, res, next) => {
  let connection;
  try {
    const { name, fatherName, class: className, gender, phone, externalRef, invoice } = req.body;
    if (!name?.trim() || !fatherName?.trim() || !className?.trim() || !['male', 'female'].includes(gender)) {
      return res.status(400).json({
        error: 'name, fatherName, class and gender (male|female) are required', code: 'VALIDATION_ERROR',
      });
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();
    if (externalRef) {
      const [existing] = await connection.query(
        `SELECT id, consumer_number, bill_id, name FROM students
         WHERE tenant_id = ? AND bill_id = ? AND deleted_at IS NULL LIMIT 1 FOR UPDATE`,
        [req.saasTenantId, String(externalRef).slice(0, 50)]
      );
      if (existing.length) {
        await connection.commit();
        return res.json({ consumerNumber: existing[0].consumer_number, consumerId: existing[0].id,
          name: existing[0].name, externalRef: existing[0].bill_id, tenantId: req.saasTenantId, idempotent: true });
      }
    }
    const allocated = await allocateConsumerNumber(connection, req.saasTenantId);
    const consumerId = uuidv4();
    const billId = externalRef ? String(externalRef).slice(0, 50) : `GW-${allocated.billerCode}-${String(allocated.sequence).padStart(5, '0')}`;
    await connection.query(
      `INSERT INTO students
       (id, tenant_id, name, father_name, class, gender, phone, consumer_number, bill_id, seq_number, status, balance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0)`,
      [consumerId, req.saasTenantId, name.trim(), fatherName.trim(), className.trim(), gender,
        phone?.trim() || null, allocated.consumerNumber, billId, allocated.sequence]
    );
    let invoiceResult = null;
    if (invoice) {
      const amount = Number(invoice.amount);
      if (!Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(String(invoice.dueDate || ''))) {
        const invalid = new Error('invoice.amount and invoice.dueDate (YYYY-MM-DD) are required');
        invalid.statusCode = 400; invalid.code = 'INVALID_INVOICE'; throw invalid;
      }
      const invoiceId = uuidv4();
      const invoiceNumber = `INV-${allocated.billerCode}-${String(allocated.sequence).padStart(6, '0')}`;
      await connection.query(
        `INSERT INTO invoices
         (id, tenant_id, invoice_number, student_id, student_name, consumer_number, month, amount, status, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [invoiceId, req.saasTenantId, invoiceNumber, consumerId, name.trim(), allocated.consumerNumber,
          String(invoice.dueDate).slice(0, 7), amount, invoice.dueDate]
      );
      await connection.query(
        `INSERT INTO ledger_entries
         (id, tenant_id, student_id, date, description, debit, credit, balance, bill_id, entry_type)
         VALUES (?, ?, ?, CURDATE(), ?, ?, 0, ?, ?, 'charge')`,
        [uuidv4(), req.saasTenantId, consumerId, invoice.description || `Invoice ${invoiceNumber}`, amount, amount, invoiceNumber]
      );
      await connection.query('UPDATE students SET balance = ? WHERE id = ?', [amount, consumerId]);
      invoiceResult = { invoiceNumber, amount, dueDate: invoice.dueDate };
    }
    await connection.commit();
    res.status(201).json({ consumerNumber: allocated.consumerNumber, consumerId, name: name.trim(),
      externalRef: billId, tenantId: req.saasTenantId, ...(invoiceResult ? { invoice: invoiceResult } : {}) });
  } catch (err) {
    if (connection) await connection.rollback();
    next(err);
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
