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
const parseDbDate = (str) => {
  if (str instanceof Date) return str;
  return new Date(String(str).replace(' ', 'T') + (String(str).includes('Z') || String(str).includes('+') ? '' : 'Z'));
};

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

// ── 1LINK reserved field parsers ─────────────────────────────────────────────
//
// Inquiry reserved layout (fixed-length, space-padded):
//   CNIC(13) + AccountId(28) + BundleID(100) + Info1(100) + Info2(144) = 385
//
// Payment reserved layout (fixed-length, space-padded):
//   CNIC(13) + City(30) + Province(20) + AccountId(28) +
//   fromAccountType(2) + fromAccountTitle(30) + BundleID(100) +
//   Info1(100) + Info2(192) = 515
//
const parseInquiryReserved = (reserved) => {
  const s = String(reserved || '').padEnd(385, ' ');
  return {
    cnic:      s.slice(0, 13).trim(),
    accountId: s.slice(13, 41).trim(),
    bundleId:  s.slice(41, 141).trim(),
    info1:     s.slice(141, 241).trim(),
    info2:     s.slice(241).trim(),
  };
};

const parsePaymentReserved = (reserved) => {
  const s = String(reserved || '').padEnd(515, ' ');
  return {
    cnic:             s.slice(0, 13).trim(),
    city:             s.slice(13, 43).trim(),
    province:         s.slice(43, 63).trim(),
    accountId:        s.slice(63, 91).trim(),
    fromAccountType:  s.slice(91, 93).trim(),
    fromAccountTitle: s.slice(93, 123).trim(),
    bundleId:         s.slice(123, 223).trim(),
    info1:            s.slice(223, 323).trim(),
    info2:            s.slice(323).trim(),
  };
};

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
    const { bundleId } = parseInquiryReserved(req.body.reserved);

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
      // Fallback: check org payment records
      const [orgRows] = await pool.query(
        `SELECT epr.*, t.name AS biller_name
         FROM org_payment_records epr
         JOIN tenants t ON epr.tenant_id = t.id
         WHERE epr.consumer_number = ?`,
        [consumerNumber]
      );

      if (orgRows.length === 0) {
        return res.json(inquiryError('01'));
      }

      const org = orgRows[0];
      const now = new Date();
      const isExpired = org.expiry_date && parseDbDate(org.expiry_date) <= now;
      const status = org.status;

      // Update status to expired if stale
      if (status === 'pending' && isExpired) {
        await pool.query(
          `UPDATE org_payment_records SET status = 'expired' WHERE id = ?`,
          [org.id]
        );
        org.status = 'expired';
      }

      if (org.status === 'paid') {
        return res.json({
          response_Code: '00',
          consumer_detail: padRight(org.description || org.application_id, 30),
          bill_status: 'P',
          due_date: org.due_date ? fmtDate(org.due_date) : '',
          amount_within_dueDate: '+0000000000000',
          amount_after_dueDate: '+0000000000000',
          billing_month: org.due_date ? fmtBillingMonth(org.due_date) : fmtBillingMonth(null),
          date_paid: org.paid_at ? fmtDate(org.paid_at) : '',
          amount_paid: org.paid_at
            ? String(Math.round(parseFloat(org.amount) * 100)).padStart(12, '0')
            : '',
          tran_auth_Id: (org.transaction_id || '').slice(0, 6),
          reserved: '',
        });
      }

      if (org.status === 'expired' || org.status === 'failed') {
        return res.json(inquiryError('01'));
      }

      // Pending org payment
      const isOverdue = org.due_date && parseDbDate(org.due_date) < now;
      // Org records don't carry a separate late_fee column — use base amount for both fields
      const amtWithin = fmtAmountInquiry(org.amount);
      const amtAfter = amtWithin; // no late-fee concept for org payments

      return res.json({
        response_Code: '00',
        consumer_detail: padRight(org.description || org.application_id, 30),
        bill_status: 'U',
        due_date: org.due_date ? fmtDate(org.due_date) : '',
        amount_within_dueDate: amtWithin,
        amount_after_dueDate: amtAfter,
        billing_month: org.due_date ? fmtBillingMonth(org.due_date) : fmtBillingMonth(null),
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

    // Also compute ledger outstanding so charges without invoices (e.g. one-time plan
    // assignments that pre-date the invoice-creation fix) are included in the amount due.
    const [ledgerTotals] = await pool.query(
      `SELECT COALESCE(SUM(debit), 0) AS totalDebit, COALESCE(SUM(credit), 0) AS totalCredit
       FROM ledger_entries WHERE student_id = ? AND tenant_id = ?`,
      [student.id, student.tenant_id]
    );
    const ledgerOutstanding = Math.max(
      0,
      parseFloat(ledgerTotals[0].totalDebit) - parseFloat(ledgerTotals[0].totalCredit)
    );

    const invoiceDue = unpaid.reduce((s, inv) => s + parseFloat(inv.amount), 0);
    // Use whichever is larger — ledger is authoritative when it includes charges beyond invoices
    const totalDue = Math.max(ledgerOutstanding, invoiceDue);
    const oldest = unpaid[0] || null;
    const now = new Date();

    // --- No unpaid invoices: distinguish "never billed" from "fully paid" ---
    if (totalDue === 0) {
      // Check whether this consumer has ever had an invoice created
      const [invCountRows] = await pool.query(
        'SELECT COUNT(*) AS cnt FROM invoices WHERE consumer_number = ? AND deleted_at IS NULL',
        [consumerNumber]
      );
      const neverInvoiced = parseInt(invCountRows[0].cnt, 10) === 0;

      // Special case: consumer was just registered (no invoice yet) but the inquiry
      // carries a bundleId in the reserved field → create the invoice now so the
      // payment flow can complete correctly.
      if (neverInvoiced && bundleId) {
        const bankMnemonic = (req.body.bank_mnemonic || '').trim();
        const [bundleRows] = await pool.query(
          `SELECT * FROM bundles
           WHERE bundle_id = ? AND status = 'active' AND deleted_at IS NULL
           LIMIT 1`,
          [bundleId]
        );

        if (bundleRows.length > 0) {
          const bundle = bundleRows[0];
          const bundleAmount = parseFloat(bundle.amount);
          const nowDate = new Date();
          const currentMonth = nowDate.toISOString().slice(0, 7);

          // Idempotency guard: don't create a duplicate invoice if inquiry is called twice
          const [dupInvRows] = await pool.query(
            `SELECT id, amount, due_date FROM invoices
             WHERE consumer_number = ? AND month = ? AND deleted_at IS NULL
             LIMIT 1`,
            [consumerNumber, currentMonth]
          );
          if (dupInvRows.length > 0) {
            const dup = dupInvRows[0];
            const dupAmount = parseFloat(dup.amount);
            const dupDue = dup.due_date ? fmtDate(dup.due_date) : '';
            logger.info(`1LINK BillInquiry: returning existing invoice for ${consumerNumber} month ${currentMonth}`);
            return res.json({
              response_Code: '00',
              consumer_detail: padRight(student.name, 30),
              bill_status: 'U',
              due_date: dupDue,
              amount_within_dueDate: fmtAmountInquiry(dupAmount),
              amount_after_dueDate: fmtAmountInquiry(dupAmount),
              billing_month: dup.due_date ? fmtBillingMonth(parseDbDate(dup.due_date)) : fmtBillingMonth(nowDate),
              date_paid: '',
              amount_paid: '',
              tran_auth_Id: '',
              reserved: '',
            });
          }

          const dueDateObj = new Date(nowDate.getTime() + 30 * 24 * 60 * 60 * 1000);
          const dueDateStr = dueDateObj.toISOString().slice(0, 10);
          const invoiceNumber = `INV-${bankMnemonic}-${Date.now()}`;

          await pool.query(
            `INSERT INTO invoices
               (id, tenant_id, invoice_number, student_id, student_name,
                consumer_number, month, amount, status, due_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
            [
              uuidv4(), student.tenant_id, invoiceNumber,
              student.id, student.name, consumerNumber,
              nowDate.toISOString().slice(0, 7), bundleAmount, dueDateStr,
            ]
          );

          logger.info(`1LINK BillInquiry: auto-created invoice ${invoiceNumber} for ${consumerNumber} bundle ${bundleId} PKR ${bundleAmount}`);

          return res.json({
            response_Code: '00',
            consumer_detail: padRight(student.name, 30),
            bill_status: 'U',
            due_date: dueDateStr.replace(/-/g, ''),
            amount_within_dueDate: fmtAmountInquiry(bundleAmount),
            amount_after_dueDate: fmtAmountInquiry(bundleAmount),
            billing_month: fmtBillingMonth(nowDate),
            date_paid: '',
            amount_paid: '',
            tran_auth_Id: '',
            reserved: '',
          });
        }
      }

      // Fully paid (all invoices settled) or consumer has no bill yet
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
    const baseAmount = totalDue;  // includes ledger-only charges (no invoice)
    const lateFeeTotal = unpaid.reduce((s, inv) => s + parseFloat(inv.late_fee || 0), 0);
    const isOverdue = unpaid.some((inv) => inv.due_date && new Date(inv.due_date) < now);
    const dueDate = oldest?.due_date ? fmtDate(oldest.due_date) : '';
    const billingMo = oldest?.due_date ? fmtBillingMonth(oldest.due_date) : fmtBillingMonth(null);

    // amount_within_dueDate: always the base amount (no late fee)
    // amount_after_dueDate:  base + late fee (same as within when not yet overdue)
    const amtWithin = fmtAmountInquiry(baseAmount);
    const amtAfter = isOverdue ? fmtAmountInquiry(baseAmount + lateFeeTotal) : amtWithin;

    return res.json({
      response_Code: '00',
      consumer_detail: padRight(student.name, 30),
      bill_status: 'U',
      due_date: dueDate,
      amount_within_dueDate: amtWithin,
      amount_after_dueDate: amtAfter,
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
    const { bundleId } = parsePaymentReserved(req.body.reserved);

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
      // Fallback: check org payment records
      const [orgRows] = await pool.query(
        `SELECT epr.*, t.id AS tenant_id, t.name AS biller_name
         FROM org_payment_records epr
         JOIN tenants t ON epr.tenant_id = t.id
         WHERE epr.consumer_number = ?`,
        [consumerNumber]
      );

      if (orgRows.length === 0) {
        return res.json(paymentError('01'));
      }

      const orgRec = orgRows[0];

      // Check org duplicate
      const orgDupKey = `${consumerNumber}:${tranAuthId}:${tranDate}:${tranTime}`;
      const [orgDupRows] = await pool.query(
        `SELECT id FROM payments WHERE reference = ? LIMIT 1`,
        [orgDupKey]
      );
      if (orgDupRows.length > 0) {
        return res.json(paymentError('03'));
      }

      // Check already paid
      if (orgRec.status === 'paid') {
        return res.json(paymentError('06'));
      }

      // Check expired / failed
      if (orgRec.status === 'expired' || orgRec.status === 'failed') {
        return res.json(paymentError('01'));
      }

      const paidAt = parseTranDateTime(tranDate, tranTime);
      const paidAtStr = isNaN(paidAt.getTime())
        ? new Date().toISOString().slice(0, 19).replace('T', ' ')
        : paidAt.toISOString().slice(0, 19).replace('T', ' ');

      // Mark org payment as paid
      await pool.query(
        `UPDATE org_payment_records SET status = 'paid', transaction_id = ?, paid_at = ? WHERE id = ?`,
        [tranAuthId, paidAtStr, orgRec.id]
      );

      // Record payment row for duplicate detection
      const paymentId = uuidv4();
      const receiptNumber = `RCPT-${Date.now()}`;
      await pool.query(
        `INSERT INTO payments
           (id, tenant_id, student_id, consumer_number, amount, date, reference, voucher_number, channel, receipt_number, note)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [paymentId, orgRec.tenant_id, consumerNumber, amount, paidAtStr,
          orgDupKey, tranAuthId, bankMnemonic, receiptNumber, `Org: ${orgRec.application_id}`]
      );

      // Record transaction
      try {
        await pool.query(
          `INSERT INTO transactions
             (id, tenant_id, transaction_id, consumer_number, amount, status, date, biller_name, channel, reference, notes)
           VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?)`,
          [uuidv4(), orgRec.tenant_id, tranAuthId, consumerNumber,
            amount, paidAtStr, orgRec.biller_name, bankMnemonic, orgDupKey, `Org app ${orgRec.application_id}`]
        );
      } catch (e) {
        // Duplicate — ignore
      }

      // Record org notification
      await pool.query(
        `INSERT INTO org_payment_notifications (id, tenant_id, application_id, payment_id, bill_id, status)
         VALUES (?, ?, ?, ?, ?, 'paid')`,
        [uuidv4(), orgRec.tenant_id, orgRec.application_id, orgRec.id, orgRec.bill_id]
      );

      await auditLog(
        req, 'payment', 'org_bill_payment', paymentId,
        `1LINK org payment ${amount} PKR via ${bankMnemonic} for ${consumerNumber}`
      );

      return res.json({
        response_Code: '00',
        Identification_parameter: (orgRec.description || orgRec.application_id).slice(0, 20),
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
      `SELECT id, amount, late_fee, due_date, late_fee_applied, month, invoice_number FROM invoices
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
        tranAuthId, bankMnemonic, receiptNumber,
        bundleId ? `bundle:${bundleId}` : null,
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
    const paidInvoices = [];
    for (const inv of unpaid) {
      const invAmt = parseFloat(inv.amount);
      if (remaining >= invAmt) {
        await pool.query(
          `UPDATE invoices SET status = 'paid', paid_at = ? WHERE id = ?`,
          [paidAtStr, inv.id]
        );
        remaining = parseFloat((remaining - invAmt).toFixed(2));
        paidInvoices.push(inv);
      } else {
        break;
      }
    }

    // Post late_fee ledger entries for each invoice paid after its due date
    const paidDate = new Date(paidAtStr);
    for (const inv of paidInvoices) {
      const lateFeeAmt = parseFloat(inv.late_fee || 0);
      const invDueDate = new Date(inv.due_date);
      if (lateFeeAmt > 0 && paidDate > invDueDate && !inv.late_fee_applied) {
        const monthLabel = inv.month || String(inv.due_date).slice(0, 7);
        await pool.query(
          `INSERT INTO ledger_entries
             (id, tenant_id, student_id, date, description, debit, credit, balance, bill_id, reference, entry_type)
           VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, 'late_fee')`,
          [uuidv4(), tenantId, student.id, paidAtStr.slice(0, 10),
            `Late Fee — ${monthLabel}`, lateFeeAmt, inv.invoice_number, dupKey]
        );
        await pool.query('UPDATE invoices SET late_fee_applied = 1 WHERE id = ?', [inv.id]);
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
