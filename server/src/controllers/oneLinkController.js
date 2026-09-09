/** 1LINK / 1BILL Generic REST invoice endpoints. */
const { pool } = require('../config/database');
const logger = require('../config/logger');
const { postPayment } = require('../services/paymentPostingService');

const fmtAmountInquiry = (amount) => {
  const minor = Math.round(Math.abs(Number(amount) || 0) * 100);
  return `+${String(minor).padStart(13, '0')}`;
};
const fmtAmountPaid = (amount) => String(Math.round((Number(amount) || 0) * 100)).padStart(12, '0');
const parsePaymentAmount = (value) => Number.parseInt(String(value || '0').replace(/^[+-]/, ''), 10) / 100;
const asDate = (value) => {
  if (value instanceof Date) return value;
  const text = String(value || '');
  return new Date(text.includes('T') ? text : `${text.replace(' ', 'T')}Z`);
};
const fmtDate = (value) => {
  const date = asDate(value || new Date());
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;
};
const fmtBillingMonth = (value) => {
  const date = asDate(value || new Date());
  return `${String(date.getUTCFullYear()).slice(-2)}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};
const parseTranDateTime = (date, time) => new Date(
  `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}Z`
);
const padRight = (value, length) => String(value || '').slice(0, length).padEnd(length, ' ');
const validConsumerNumber = (value) => /^\d{1,24}$/.test(value);
const validBankMnemonic = (value) => /^[A-Za-z0-9]{1,8}$/.test(value);

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
const paymentError = (code) => ({ response_Code: code, Identification_parameter: '', reserved: '' });
const paidInquiry = (detail, dueDate, payment) => ({
  response_Code: '00',
  consumer_detail: padRight(detail, 30),
  bill_status: 'P',
  due_date: dueDate ? fmtDate(dueDate) : '',
  amount_within_dueDate: '+0000000000000',
  amount_after_dueDate: '+0000000000000',
  billing_month: dueDate ? fmtBillingMonth(dueDate) : fmtBillingMonth(new Date()),
  date_paid: payment?.received_at || payment?.date ? fmtDate(payment.received_at || payment.date) : '',
  amount_paid: payment ? fmtAmountPaid(payment.amount) : '',
  tran_auth_Id: payment && /^\d{6}$/.test(String(payment.transaction_id || ''))
    ? String(payment.transaction_id) : '',
  reserved: '',
});

const billInquiry1Link = async (req, res) => {
  try {
    const consumerNumber = String(req.body.consumer_number || '').trim();
    const bankMnemonic = String(req.body.bank_mnemonic || '').trim();
    const reserved = String(req.body.reserved || '');
    if (!validConsumerNumber(consumerNumber) || !validBankMnemonic(bankMnemonic) || reserved.length > 400) {
      return res.json(inquiryError('04'));
    }

    const [students] = await pool.query(
      `SELECT s.id, s.tenant_id, s.name, s.status
       FROM students s JOIN tenants t ON t.id = s.tenant_id
       WHERE s.consumer_number = ? AND s.deleted_at IS NULL
         AND t.deleted_at IS NULL AND t.status = 'active' AND t.lifecycle_stage = 'live'
       LIMIT 1`,
      [consumerNumber]
    );
    if (students.length) {
      const student = students[0];
      if (student.status !== 'active') return res.json(inquiryError('02'));
      const [invoices] = await pool.query(
        `SELECT id, invoice_number, amount, due_date, late_fee, late_fee_applied
         FROM invoices WHERE tenant_id = ? AND consumer_number = ?
           AND status != 'paid' AND deleted_at IS NULL ORDER BY due_date ASC`,
        [student.tenant_id, consumerNumber]
      );
      const [[ledger]] = await pool.query(
        `SELECT COALESCE(SUM(debit),0) AS debit, COALESCE(SUM(credit),0) AS credit
         FROM ledger_entries WHERE tenant_id = ? AND student_id = ?`,
        [student.tenant_id, student.id]
      );
      const invoiceDue = invoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0);
      const ledgerDue = Math.max(0, Number(ledger.debit) - Number(ledger.credit));
      const baseDue = Math.max(invoiceDue, ledgerDue);
      if (baseDue === 0) {
        const [payments] = await pool.query(
          `SELECT amount, received_at, date, voucher_number AS transaction_id, reference FROM payments
           WHERE tenant_id = ? AND consumer_number = ? AND status = 'posted'
           ORDER BY received_at DESC, created_at DESC LIMIT 1`,
          [student.tenant_id, consumerNumber]
        );
        return res.json(paidInquiry(student.name, null, payments[0]));
      }
      const now = new Date();
      const oldest = invoices[0] || null;
      const lateFees = invoices.reduce((sum, invoice) => {
        const overdue = invoice.due_date && asDate(`${invoice.due_date} 23:59:59`) < now;
        return sum + (overdue && !invoice.late_fee_applied ? Number(invoice.late_fee || 0) : 0);
      }, 0);
      return res.json({
        response_Code: '00',
        consumer_detail: padRight(student.name, 30),
        bill_status: 'U',
        due_date: oldest?.due_date ? fmtDate(oldest.due_date) : '',
        amount_within_dueDate: fmtAmountInquiry(baseDue),
        amount_after_dueDate: fmtAmountInquiry(baseDue + lateFees),
        billing_month: oldest?.due_date ? fmtBillingMonth(oldest.due_date) : fmtBillingMonth(new Date()),
        date_paid: '', amount_paid: '', tran_auth_Id: '', reserved: '',
      });
    }

    const [records] = await pool.query(
      `SELECT o.* FROM org_payment_records o JOIN tenants t ON t.id = o.tenant_id
       WHERE o.consumer_number = ? AND t.deleted_at IS NULL
         AND t.status = 'active' AND t.lifecycle_stage = 'live'
       ORDER BY o.created_at DESC LIMIT 1`,
      [consumerNumber]
    );
    if (!records.length) return res.json(inquiryError('01'));
    const record = records[0];
    if (record.status === 'paid') {
      return res.json(paidInquiry(record.description || record.application_id, record.due_date, {
        amount: record.amount, received_at: record.paid_at, transaction_id: record.transaction_id,
      }));
    }
    if (record.status !== 'pending' || (record.expiry_date && asDate(record.expiry_date) <= new Date())) {
      return res.json(inquiryError(record.status === 'failed' ? '02' : '01'));
    }
    return res.json({
      response_Code: '00',
      consumer_detail: padRight(record.description || record.application_id, 30),
      bill_status: 'U',
      due_date: record.due_date ? fmtDate(record.due_date) : '',
      amount_within_dueDate: fmtAmountInquiry(record.amount),
      amount_after_dueDate: fmtAmountInquiry(record.amount),
      billing_month: record.due_date ? fmtBillingMonth(record.due_date) : fmtBillingMonth(new Date()),
      date_paid: '', amount_paid: '', tran_auth_Id: '', reserved: '',
    });
  } catch (err) {
    logger.error('1LINK BillInquiry error:', err);
    return res.json(inquiryError('03'));
  }
};

const billPayment1Link = async (req, res) => {
  try {
    const consumerNumber = String(req.body.consumer_number || '').trim();
    const tranAuthId = String(req.body.tran_auth_id || '').trim();
    const tranDate = String(req.body.tran_date || '').trim();
    const tranTime = String(req.body.tran_time || '').trim();
    const bankMnemonic = String(req.body.bank_mnemonic || '').trim();
    const reserved = String(req.body.reserved || '');
    if (!validConsumerNumber(consumerNumber) || !/^\d{6}$/.test(tranAuthId)
      || !/^\d{12}$/.test(String(req.body.transaction_amount || ''))
      || !/^\d{8}$/.test(tranDate) || !/^\d{6}$/.test(tranTime)
      || !validBankMnemonic(bankMnemonic) || reserved.length > 515) {
      return res.json(paymentError('04'));
    }
    const amount = parsePaymentAmount(req.body.transaction_amount);
    const receivedAt = parseTranDateTime(tranDate, tranTime);
    if (!Number.isFinite(amount) || amount <= 0 || Number.isNaN(receivedAt.getTime())) return res.json(paymentError('04'));

    // A completed bill may no longer appear in the payable-target query. Detect
    // an exact 1LINK replay first so the gateway receives the duplicate code
    // instead of a misleading "not found" response.
    const duplicateKey = `${consumerNumber}:${tranAuthId}:${tranDate}:${tranTime}`;
    const [duplicatePayments] = await pool.query(
      `SELECT id FROM payments
       WHERE consumer_number = ? AND idempotency_key = ? AND source = 'onelink'
       LIMIT 1`,
      [consumerNumber, duplicateKey]
    );
    if (duplicatePayments.length) return res.json(paymentError('03'));

    const [targets] = await pool.query(
      `SELECT s.tenant_id, NULL AS target_id, 'invoice' AS target_type, s.name AS detail
       FROM students s JOIN tenants t ON t.id = s.tenant_id
       WHERE s.consumer_number = ? AND s.deleted_at IS NULL AND s.status = 'active'
         AND t.deleted_at IS NULL AND t.status = 'active' AND t.lifecycle_stage = 'live'
       UNION ALL
       SELECT o.tenant_id, o.id AS target_id, 'org_payment' AS target_type,
              COALESCE(o.description, o.application_id) AS detail
       FROM org_payment_records o JOIN tenants t ON t.id = o.tenant_id
       WHERE o.consumer_number = ?
         AND t.deleted_at IS NULL AND t.status = 'active' AND t.lifecycle_stage = 'live'
       LIMIT 1`,
      [consumerNumber, consumerNumber]
    );
    if (!targets.length) return res.json(paymentError('01'));
    const target = targets[0];
    const result = await postPayment({
      tenantId: target.tenant_id,
      targetType: target.target_type,
      orgPaymentId: target.target_id,
      consumerNumber,
      amount,
      receivedAt,
      channel: bankMnemonic,
      externalReference: duplicateKey,
      transactionId: tranAuthId,
      idempotencyKey: duplicateKey,
      voucherNumber: tranAuthId,
      note: '1LINK invoice payment',
      source: 'onelink',
      actorName: '1LINK',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return res.json({
      response_Code: '00',
      Identification_parameter: String(target.detail || result.consumerNumber).slice(0, 20),
      reserved: '',
    });
  } catch (err) {
    const mapping = {
      BILL_NOT_FOUND: '01', TENANT_NOT_FOUND: '01', TENANT_SUSPENDED: '01',
      TENANT_NOT_LIVE: '01', CONSUMER_BLOCKED: '01', BILL_EXPIRED: '01',
      BILL_NOT_PAYABLE: '01', ALREADY_PAID: '06', DUPLICATE_PAYMENT: '03', ER_DUP_ENTRY: '03',
      AMOUNT_MISMATCH: '04', INVALID_AMOUNT: '04', INVALID_RECEIVED_AT: '04',
    };
    logger.warn(`1LINK BillPayment rejected: ${err.code || err.message}`);
    return res.json(paymentError(mapping[err.code] || '02'));
  }
};

module.exports = { billInquiry1Link, billPayment1Link };
