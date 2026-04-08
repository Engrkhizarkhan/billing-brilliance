/**
 * 1LINK / 1BILL Generic REST Specification v1.5 endpoints
 *
 * BillInquiry  — POST /api/1.0/Payments/BillInquiry
 * BillPayment  — POST /api/1.0/Payments/BillPayment
 *
 * Auth: caller sends `username` + `password` HTTP headers.
 * Credentials are configured via ONELINK_USERNAME / ONELINK_PASSWORD env vars.
 *
 * These endpoints are called by the external 1LINK gateway (ATM / mobile banking).
 * Internal dashboard calls continue to use /api/billing/inquiry and /api/billing/payment.
 */

const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { auditLog } = require('../middleware/auditLog');
const logger = require('../config/logger');

// ── Amount helpers ────────────────────────────────────────────────────────────

/**
 * Format a PKR amount for 1LINK inquiry response.
 * Returns AN14: sign(1) + minor-units left-padded to 13 digits.
 * e.g. 1890.00 → "+0000000189000"
 */
const fmtAmountInquiry = (amount) => {
  const minor = Math.round(Math.abs(parseFloat(amount) || 0) * 100);
  return '+' + String(minor).padStart(13, '0');
};

/**
 * Parse a 1LINK payment amount (AN12, no sign).
 * e.g. "000000012000" → 120.00
 */
const parsePaymentAmount = (str) => {
  const clean = (str || '0').replace(/^[+-]/, '').trim();
  return parseInt(clean, 10) / 100;
};

// ── Date helpers ─────────────────────────────────────────────────────────────

/** Parse a MySQL DATETIME string returned with dateStrings:true as UTC */
const parseDbDate = (str) => new Date(String(str).replace(' ', 'T') + (String(str).includes('Z') || String(str).includes('+') ? '' : 'Z'));

/** Format a date to 1LINK yyyyMMdd */
const fmtDate = (date) => {
  const d = date ? parseDbDate(date) : new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}${mo}${dy}`;
};

/** Format a date to 1LINK yyMM billing month */
const fmtBillingMonth = (date) => {
  const d = date ? parseDbDate(date) : new Date();
  return String(d.getFullYear()).slice(-2) + String(d.getMonth() + 1).padStart(2, '0');
};

/** Parse 1LINK date (YYYYMMDD) + time (HHMMSS) into a JS Date */
const parseTranDateTime = (tranDate, tranTime) => {
  try {
    const d = (tranDate || '').trim();
    const t = (tranTime || '000000').trim().padEnd(6, '0');
    return new Date(
      `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T` +
      `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`
    );
  } catch {
    return new Date();
  }
};

// ── String helpers ────────────────────────────────────────────────────────────

/** Left-justify, right-pad with spaces, truncate to maxLen */
const padRight = (str, maxLen) => String(str || '').slice(0, maxLen).padEnd(maxLen, ' ');

// ── Error response shapes ─────────────────────────────────────────────────────

const inquiryError = (code) => ({
  response_Code: code,
  consumer_detail: padRight('', 30),
  bill_status: 'B',
  due_date: '',
  amount_within_dueDate: '+0000000000000',
  amount_after_dueDate: '+0000000000000',
  billing_month: '',
  date_paid: '',
  amount_paid: '',
  tran_auth_Id: '',
  reserved: '',
});

const paymentError = (code) => ({
  response_Code: code,
  Identification_parameter: '',
  reserved: '',
});

// ── BillInquiry ───────────────────────────────────────────────────────────────

/**
 * POST /api/1.0/Payments/BillInquiry
 *
 * 1LINK request fields:
 *   consumer_number, bank_mnemonic, reserved (optional)
 *
 * 1LINK response fields:
 *   response_Code, consumer_detail, bill_status, due_date,
 *   amount_within_dueDate, amount_after_dueDate, billing_month,
 *   date_paid, amount_paid, tran_auth_Id, reserved
 */
const billInquiry1Link = async (req, res) => {
  try {
    const consumerNumber = (req.body.consumer_number || '').trim();

    if (!consumerNumber) {
      return res.json(inquiryError('04'));
    }

    // Look up student + tenant
    const [studentRows] = await pool.query(
      `SELECT s.*, t.biller_code, t.name AS biller_name
       FROM students s
       JOIN tenants t ON s.tenant_id = t.id
       WHERE s.consumer_number = ? AND s.deleted_at IS NULL`,
      [consumerNumber]
    );

    if (studentRows.length === 0) {
      // Fallback: check ETEA payment records
      const [eteaRows] = await pool.query(
        `SELECT epr.*, t.name AS biller_name
         FROM etea_payment_records epr
         JOIN tenants t ON epr.tenant_id = t.id
         WHERE epr.consumer_number = ?`,
        [consumerNumber]
      );

      if (eteaRows.length === 0) {
        return res.json(inquiryError('01'));
      }

      const etea = eteaRows[0];
      const now = new Date();
      const isExpired = etea.expiry_date && parseDbDate(etea.expiry_date) <= now;
      const status = etea.status;

      // Update status to expired if stale
      if (status === 'pending' && isExpired) {
        await pool.query(
          `UPDATE etea_payment_records SET status = 'expired' WHERE id = ?`,
          [etea.id]
        );
        etea.status = 'expired';
      }

      if (etea.status === 'paid') {
        return res.json({
          response_Code: '00',
          consumer_detail: padRight(etea.description || etea.application_id, 30),
          bill_status: 'P',
          due_date: etea.due_date ? fmtDate(etea.due_date) : '',
          amount_within_dueDate: '+0000000000000',
          amount_after_dueDate: '+0000000000000',
          billing_month: etea.due_date ? fmtBillingMonth(etea.due_date) : fmtBillingMonth(null),
          date_paid: etea.paid_at ? fmtDate(etea.paid_at) : '',
          amount_paid: etea.paid_at
            ? String(Math.round(parseFloat(etea.amount) * 100)).padStart(12, '0')
            : '',
          tran_auth_Id: (etea.transaction_id || '').slice(0, 6),
          reserved: '',
        });
      }

      if (etea.status === 'expired' || etea.status === 'failed') {
        return res.json(inquiryError('01'));
      }

      // Pending
      const isOverdue = etea.due_date && parseDbDate(etea.due_date) < now;
      const amtFormatted = fmtAmountInquiry(etea.amount);

      return res.json({
        response_Code: '00',
        consumer_detail: padRight(etea.description || etea.application_id, 30),
        bill_status: 'U',
        due_date: etea.due_date ? fmtDate(etea.due_date) : '',
        amount_within_dueDate: isOverdue ? '+0000000000000' : amtFormatted,
        amount_after_dueDate: amtFormatted,
        billing_month: etea.due_date ? fmtBillingMonth(etea.due_date) : fmtBillingMonth(null),
        date_paid: '',
        amount_paid: '',
        tran_auth_Id: '',
        reserved: '',
      });
    }

    const student = studentRows[0];

    // Fetch all unpaid invoices (oldest first)
    const [unpaid] = await pool.query(
      `SELECT * FROM invoices
       WHERE consumer_number = ? AND status != 'paid' AND deleted_at IS NULL
       ORDER BY due_date ASC`,
      [consumerNumber]
    );

    const totalDue = unpaid.reduce((s, inv) => s + parseFloat(inv.amount), 0);
    const oldest = unpaid[0] || null;
    const now = new Date();

    // --- Fully paid ---
    if (totalDue === 0) {
      const [paidRows] = await pool.query(
        `SELECT * FROM payments WHERE consumer_number = ? ORDER BY date DESC LIMIT 1`,
        [consumerNumber]
      );
      const last = paidRows[0] || null;

      return res.json({
        response_Code: '00',
        consumer_detail: padRight(student.name, 30),
        bill_status: 'P',
        due_date: oldest?.due_date ? fmtDate(oldest.due_date) : '',
        amount_within_dueDate: '+0000000000000',
        amount_after_dueDate: '+0000000000000',
        billing_month: oldest?.due_date ? fmtBillingMonth(oldest.due_date) : fmtBillingMonth(null),
        date_paid: last ? fmtDate(last.date) : '',
        amount_paid: last
          ? String(Math.round(parseFloat(last.amount) * 100)).padStart(12, '0')
          : '',
        tran_auth_Id: last
          ? (last.receipt_number || last.reference || '').slice(0, 6)
          : '',
        reserved: '',
      });
    }

    // --- Unpaid / overdue ---
    const isOverdue = unpaid.some((inv) => inv.due_date && new Date(inv.due_date) < now);
    const dueDate = oldest?.due_date ? fmtDate(oldest.due_date) : '';
    const billingMo = oldest?.due_date ? fmtBillingMonth(oldest.due_date) : fmtBillingMonth(null);
    const amtFormatted = fmtAmountInquiry(totalDue);

    return res.json({
      response_Code: '00',
      consumer_detail: padRight(student.name, 30),
      bill_status: 'U',
      due_date: dueDate,
      // amount_within_dueDate: 0 if already overdue; otherwise full outstanding
      amount_within_dueDate: isOverdue ? '+0000000000000' : amtFormatted,
      amount_after_dueDate: amtFormatted,
      billing_month: billingMo,
      date_paid: '',
      amount_paid: '',
      tran_auth_Id: '',
      reserved: '',
    });
  } catch (err) {
    logger.error('1LINK BillInquiry error:', err);
    return res.json(inquiryError('03'));
  }
};

// ── BillPayment ───────────────────────────────────────────────────────────────

/**
 * POST /api/1.0/Payments/BillPayment
 *
 * 1LINK request fields:
 *   consumer_number, tran_auth_id, transaction_amount (AN12),
 *   tran_date (YYYYMMDD), tran_time (HHMMSS), bank_mnemonic, reserved (optional)
 *
 * Duplicate transaction key: consumer_number + tran_auth_id + tran_date + tran_time
 *
 * 1LINK response fields:
 *   response_Code, Identification_parameter, reserved
 */
const billPayment1Link = async (req, res) => {
  try {
    const {
      consumer_number,
      tran_auth_id,
      transaction_amount,
      tran_date,
      tran_time,
      bank_mnemonic,
    } = req.body;

    const consumerNumber = (consumer_number || '').trim();
    const tranAuthId = (tran_auth_id || '').trim();
    const tranDate = (tran_date || '').trim();
    const tranTime = (tran_time || '').trim();
    const bankMnemonic = (bank_mnemonic || '1LINK').trim();

    // Required field validation
    if (!consumerNumber || !tranAuthId || !transaction_amount || !tranDate || !tranTime) {
      return res.json(paymentError('04'));
    }

    // Parse amount from AN12 to float
    const amount = parsePaymentAmount(transaction_amount);
    if (isNaN(amount) || amount <= 0) {
      return res.json(paymentError('04'));
    }

    // Look up student + tenant
    const [studentRows] = await pool.query(
      `SELECT s.*, t.id AS tenant_id, t.name AS biller_name
       FROM students s
       JOIN tenants t ON s.tenant_id = t.id
       WHERE s.consumer_number = ? AND s.deleted_at IS NULL`,
      [consumerNumber]
    );

    if (studentRows.length === 0) {
      // Fallback: check ETEA payment records
      const [eteaRows] = await pool.query(
        `SELECT epr.*, t.id AS tenant_id, t.name AS biller_name
         FROM etea_payment_records epr
         JOIN tenants t ON epr.tenant_id = t.id
         WHERE epr.consumer_number = ?`,
        [consumerNumber]
      );

      if (eteaRows.length === 0) {
        return res.json(paymentError('01'));
      }

      const etea = eteaRows[0];

      // Check ETEA duplicate
      const eteaDupKey = `${consumerNumber}:${tranAuthId}:${tranDate}:${tranTime}`;
      const [eteaDupRows] = await pool.query(
        `SELECT id FROM payments WHERE reference = ? LIMIT 1`,
        [eteaDupKey]
      );
      if (eteaDupRows.length > 0) {
        return res.json(paymentError('03'));
      }

      // Check already paid
      if (etea.status === 'paid') {
        return res.json(paymentError('06'));
      }

      // Check expired / failed
      if (etea.status === 'expired' || etea.status === 'failed') {
        return res.json(paymentError('01'));
      }

      const paidAt = parseTranDateTime(tranDate, tranTime);
      const paidAtStr = isNaN(paidAt.getTime())
        ? new Date().toISOString().slice(0, 19).replace('T', ' ')
        : paidAt.toISOString().slice(0, 19).replace('T', ' ');

      // Mark ETEA payment as paid
      await pool.query(
        `UPDATE etea_payment_records SET status = 'paid', transaction_id = ?, paid_at = ? WHERE id = ?`,
        [tranAuthId, paidAtStr, etea.id]
      );

      // Record payment row for duplicate detection
      const paymentId = uuidv4();
      const receiptNumber = `RCPT-${Date.now()}`;
      await pool.query(
        `INSERT INTO payments
           (id, tenant_id, student_id, consumer_number, amount, date, reference, voucher_number, channel, receipt_number, note)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [paymentId, etea.tenant_id, consumerNumber, amount, paidAtStr,
          eteaDupKey, tranAuthId, bankMnemonic, receiptNumber, `ETEA: ${etea.application_id}`]
      );

      // Record transaction
      try {
        await pool.query(
          `INSERT INTO transactions
             (id, tenant_id, transaction_id, consumer_number, amount, status, date, biller_name, channel, reference, notes)
           VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?)`,
          [uuidv4(), etea.tenant_id, tranAuthId, consumerNumber,
            amount, paidAtStr, etea.biller_name, bankMnemonic, eteaDupKey, `ETEA app ${etea.application_id}`]
        );
      } catch (e) {
        // Duplicate — ignore
      }

      // Record ETEA notification
      await pool.query(
        `INSERT INTO etea_payment_notifications (id, tenant_id, application_id, payment_id, bill_id, status)
         VALUES (?, ?, ?, ?, ?, 'paid')`,
        [uuidv4(), etea.tenant_id, etea.application_id, etea.id, etea.bill_id]
      );

      await auditLog(
        req, 'payment', 'etea_bill_payment', paymentId,
        `1LINK ETEA payment ${amount} PKR via ${bankMnemonic} for ${consumerNumber}`
      );

      return res.json({
        response_Code: '00',
        Identification_parameter: (etea.description || etea.application_id).slice(0, 20),
        reserved: '',
      });
    }

    const student = studentRows[0];
    const tenantId = student.tenant_id;

    // Duplicate detection: unique key = consumerNumber:tranAuthId:tranDate:tranTime
    const dupKey = `${consumerNumber}:${tranAuthId}:${tranDate}:${tranTime}`;
    const [dupRows] = await pool.query(
      `SELECT id FROM payments WHERE reference = ? LIMIT 1`,
      [dupKey]
    );
    if (dupRows.length > 0) {
      return res.json(paymentError('03'));
    }

    // Check if already fully paid
    const [unpaid] = await pool.query(
      `SELECT id, amount FROM invoices
       WHERE consumer_number = ? AND status != 'paid' AND deleted_at IS NULL
       ORDER BY due_date ASC`,
      [consumerNumber]
    );
    if (unpaid.length === 0) {
      return res.json(paymentError('06'));
    }

    // Build paidAt timestamp
    const paidAt = parseTranDateTime(tranDate, tranTime);
    const paidAtStr = isNaN(paidAt.getTime())
      ? new Date().toISOString().slice(0, 19).replace('T', ' ')
      : paidAt.toISOString().slice(0, 19).replace('T', ' ');

    // First unpaid invoice number for receipt reference
    const [firstUnpaid] = await pool.query(
      `SELECT invoice_number FROM invoices
       WHERE consumer_number = ? AND status != 'paid' AND deleted_at IS NULL
       ORDER BY due_date ASC LIMIT 1`,
      [consumerNumber]
    );
    const invoiceNumber = firstUnpaid[0]?.invoice_number || null;

    // Record payment (reference = dupKey ensures idempotency)
    const paymentId = uuidv4();
    const receiptNumber = `RCPT-${Date.now()}`;
    await pool.query(
      `INSERT INTO payments
         (id, tenant_id, student_id, consumer_number, amount, date, reference, voucher_number, channel, receipt_number, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paymentId, tenantId, student.id, consumerNumber,
        amount, paidAtStr, dupKey,
        tranAuthId, bankMnemonic, receiptNumber, null,
      ]
    );

    // Record transaction
    await pool.query(
      `INSERT INTO transactions
         (id, tenant_id, transaction_id, consumer_number, amount, status, date, biller_name, channel, reference, notes)
       VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?)`,
      [
        uuidv4(), tenantId, tranAuthId, consumerNumber,
        amount, paidAtStr, student.biller_name, bankMnemonic, dupKey, null,
      ]
    );

    // Apply payment to invoices oldest-first; only mark paid when fully covered
    let remaining = parseFloat(amount.toFixed(2));
    for (const inv of unpaid) {
      const invAmt = parseFloat(inv.amount);
      if (remaining >= invAmt) {
        await pool.query(
          `UPDATE invoices SET status = 'paid', paid_at = NOW() WHERE id = ?`,
          [inv.id]
        );
        remaining = parseFloat((remaining - invAmt).toFixed(2));
      } else {
        break;
      }
    }

    // Ledger entry
    await pool.query(
      `INSERT INTO ledger_entries
         (id, tenant_id, student_id, date, description, debit, credit, balance, bill_id, reference, entry_type)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'payment')`,
      [
        uuidv4(), tenantId, student.id, paidAtStr,
        `Payment via 1LINK (${bankMnemonic})`,
        amount, amount, invoiceNumber, dupKey,
      ]
    );

    await auditLog(
      req, 'payment', 'bill_payment', paymentId,
      `1LINK payment ${amount} PKR via ${bankMnemonic} for ${consumerNumber}`
    );

    return res.json({
      response_Code: '00',
      Identification_parameter: student.name.slice(0, 20),
      reserved: '',
    });
  } catch (err) {
    logger.error('1LINK BillPayment error:', err);
    return res.json(paymentError('02'));
  }
};

module.exports = { billInquiry1Link, billPayment1Link };
