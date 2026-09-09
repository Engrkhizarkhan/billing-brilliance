const { pool } = require('../config/database');
const config = require('../config');
const { postPayment, reverseManualPayment } = require('../services/paymentPostingService');

const toDate = (value) => {
  if (value instanceof Date) return value;
  const text = String(value || '');
  return new Date(text.includes('T') ? text : `${text.replace(' ', 'T')}Z`);
};
const formatDate = (value) => {
  const date = toDate(value || new Date());
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;
};
const formatMonth = (value) => {
  const date = toDate(value || new Date());
  return `${String(date.getUTCFullYear()).slice(-2)}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};
const inquiryAmount = (amount) => `+${String(Math.round(Math.abs(Number(amount) || 0) * 100)).padStart(13, '0')}`;
const paidAmount = (amount) => String(Math.round((Number(amount) || 0) * 100)).padStart(12, '0');
const detail = (value) => String(value || '').slice(0, 30).padEnd(30, ' ');
const unavailableResponse = (code = '01') => ({
  response_Code: code,
  consumer_detail: detail(''),
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
const paidResponse = (label, dueDate, payment) => ({
  response_Code: '00',
  consumer_detail: detail(label),
  bill_status: 'P',
  due_date: dueDate ? formatDate(dueDate) : '',
  amount_within_dueDate: '+0000000000000',
  amount_after_dueDate: '+0000000000000',
  billing_month: dueDate ? formatMonth(dueDate) : formatMonth(new Date()),
  date_paid: payment?.received_at || payment?.date ? formatDate(payment.received_at || payment.date) : '',
  amount_paid: payment ? paidAmount(payment.amount) : '',
  tran_auth_Id: /^\d{6}$/.test(String(payment?.transaction_id || '')) ? String(payment.transaction_id) : '',
  reserved: '',
});

const tenantCanCollect = (tenant) => tenant.status === 'active'
  && (config.appEnvironment !== 'production' || tenant.lifecycle_stage === 'live');

/** Platform-admin lookup used before a manually verified payment is posted. */
const inquirePayment = async (req, res, next) => {
  try {
    const consumerNumber = String(req.body.consumerNumber || '').trim();
    const [students] = await pool.query(
      `SELECT s.id, s.tenant_id, s.name, s.class, s.section, s.bill_id,
              s.consumer_number, s.status, t.name AS tenant_name, t.biller_code,
              t.status AS tenant_status, t.lifecycle_stage
       FROM students s JOIN tenants t ON t.id = s.tenant_id
       WHERE s.consumer_number = ? AND s.deleted_at IS NULL AND t.deleted_at IS NULL
       LIMIT 1`,
      [consumerNumber]
    );

    if (students.length) {
      const student = students[0];
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
      const now = new Date();
      const lateFees = invoices.reduce((sum, invoice) => {
        const overdue = invoice.due_date && toDate(`${invoice.due_date} 23:59:59`) < now;
        return sum + (overdue && !invoice.late_fee_applied ? Number(invoice.late_fee || 0) : 0);
      }, 0);
      const amount = Math.round((baseDue + lateFees) * 100) / 100;
      const oldest = invoices[0] || null;
      const allowed = tenantCanCollect({ status: student.tenant_status, lifecycle_stage: student.lifecycle_stage });
      const payable = allowed && student.status === 'active' && amount > 0;
      let oneBillResponse;
      if (!allowed) oneBillResponse = unavailableResponse('01');
      else if (student.status !== 'active') oneBillResponse = unavailableResponse('02');
      else if (amount === 0) {
        const [payments] = await pool.query(
          `SELECT amount, received_at, date, voucher_number AS transaction_id
           FROM payments WHERE tenant_id = ? AND consumer_number = ? AND status = 'posted'
           ORDER BY received_at DESC, created_at DESC LIMIT 1`,
          [student.tenant_id, consumerNumber]
        );
        oneBillResponse = paidResponse(student.name, null, payments[0]);
      } else {
        oneBillResponse = {
          response_Code: '00', consumer_detail: detail(student.name), bill_status: 'U',
          due_date: oldest?.due_date ? formatDate(oldest.due_date) : '',
          amount_within_dueDate: inquiryAmount(baseDue),
          amount_after_dueDate: inquiryAmount(baseDue + lateFees),
          billing_month: oldest?.due_date ? formatMonth(oldest.due_date) : formatMonth(now),
          date_paid: '', amount_paid: '', tran_auth_Id: '', reserved: '',
        };
      }
      return res.json({
        data: {
          found: true, targetType: 'invoice', tenantId: student.tenant_id,
          tenantName: student.tenant_name, billerCode: student.biller_code,
          tenantStatus: student.tenant_status, lifecycleStage: student.lifecycle_stage,
          consumerStatus: student.status, consumerNumber, payerName: student.name,
          className: student.class, section: student.section, billId: student.bill_id,
          invoiceNumber: oldest?.invoice_number || null, dueDate: oldest?.due_date || null,
          pendingCount: invoices.length, baseAmount: baseDue, lateFee: lateFees, amount,
          currency: 'PKR', payable,
          reason: payable ? null : amount === 0 ? 'This bill is already paid'
            : student.status !== 'active' ? 'Consumer is blocked'
              : 'The biller is not enabled for collection',
          oneBillResponse,
        },
      });
    }

    const [records] = await pool.query(
      `SELECT o.*, t.name AS tenant_name, t.biller_code, t.status AS tenant_status,
              t.lifecycle_stage
       FROM org_payment_records o JOIN tenants t ON t.id = o.tenant_id
       WHERE o.consumer_number = ? AND t.deleted_at IS NULL
       ORDER BY o.created_at DESC LIMIT 1`,
      [consumerNumber]
    );
    if (!records.length) {
      return res.json({ data: { found: false, consumerNumber, payable: false,
        reason: 'Consumer number not found', oneBillResponse: unavailableResponse('01') } });
    }

    const record = records[0];
    const allowed = tenantCanCollect({ status: record.tenant_status, lifecycle_stage: record.lifecycle_stage });
    const expired = record.expiry_date && toDate(record.expiry_date) <= new Date();
    const payable = allowed && record.status === 'pending' && !expired;
    let oneBillResponse;
    if (!allowed) oneBillResponse = unavailableResponse('01');
    else if (record.status === 'paid') oneBillResponse = paidResponse(
      record.description || record.application_id, record.due_date,
      { amount: record.amount, received_at: record.paid_at, transaction_id: record.transaction_id }
    );
    else if (!payable) oneBillResponse = unavailableResponse(record.status === 'failed' ? '02' : '01');
    else oneBillResponse = {
      response_Code: '00', consumer_detail: detail(record.description || record.application_id),
      bill_status: 'U', due_date: record.due_date ? formatDate(record.due_date) : '',
      amount_within_dueDate: inquiryAmount(record.amount), amount_after_dueDate: inquiryAmount(record.amount),
      billing_month: record.due_date ? formatMonth(record.due_date) : formatMonth(new Date()),
      date_paid: '', amount_paid: '', tran_auth_Id: '', reserved: '',
    };
    return res.json({
      data: {
        found: true, targetType: 'org_payment', targetId: record.id,
        tenantId: record.tenant_id, tenantName: record.tenant_name,
        billerCode: record.biller_code, tenantStatus: record.tenant_status,
        lifecycleStage: record.lifecycle_stage, consumerStatus: record.status,
        consumerNumber, payerName: record.description || record.application_id,
        applicationId: record.application_id, billId: record.bill_id,
        dueDate: record.due_date, expiryDate: record.expiry_date,
        pendingCount: record.status === 'pending' ? 1 : 0, baseAmount: Number(record.amount),
        lateFee: 0, amount: Number(record.amount), currency: 'PKR', payable,
        reason: payable ? null : record.status === 'paid' ? 'This bill is already paid'
          : expired ? 'This bill has expired' : record.status === 'failed' ? 'This bill is blocked'
            : 'The biller is not enabled for collection',
        oneBillResponse,
      },
    });
  } catch (err) {
    next(err);
  }
};

const recordPayment = async (req, res, next) => {
  try {
    const result = await postPayment({
      tenantId: req.tenantId,
      targetType: req.body.targetType === 'org_payment' ? 'org_payment' : 'invoice',
      invoiceId: req.body.invoiceId || null,
      orgPaymentId: req.body.orgPaymentId || null,
      consumerNumber: String(req.body.consumerNumber || '').trim(),
      amount: Number(req.body.amount),
      receivedAt: req.body.receivedAt,
      channel: req.body.channel || 'counter',
      externalReference: String(req.body.externalReference || '').trim(),
      transactionId: String(req.body.externalReference || '').trim(),
      idempotencyKey: req.headers['x-idempotency-key'] || req.body.idempotencyKey || null,
      voucherNumber: req.body.voucherNumber || null,
      note: req.body.reason,
      source: 'manual',
      currency: 'PKR',
      actorUserId: req.user.id,
      actorName: req.user.name,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.status(201).json({ data: result, message: 'Payment recorded successfully' });
  } catch (err) {
    next(err);
  }
};

const reversePayment = async (req, res, next) => {
  try {
    const result = await reverseManualPayment({
      tenantId: req.tenantId,
      paymentId: req.body.paymentId,
      confirmation: req.body.confirmation,
      reason: req.body.reason,
      actorUserId: req.user.id,
      actorName: req.user.name,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.status(201).json({ data: result, message: 'Manual payment reversed' });
  } catch (err) {
    next(err);
  }
};

module.exports = { inquirePayment, recordPayment, reversePayment };
