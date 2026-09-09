const { pool } = require('../config/database');
const { postPayment } = require('../services/paymentPostingService');

/** Internal, tenant-scoped bill inquiry used by school dashboards and tenant APIs. */
const billInquiry = async (req, res, next) => {
  try {
    const consumerNumber = String(req.body.consumerNumber || '').trim();
    const [students] = await pool.query(
      `SELECT s.id, s.name, s.class, s.section, s.bill_id, s.consumer_number,
              s.status, t.biller_code, t.name AS biller_name
       FROM students s
       JOIN tenants t ON t.id = s.tenant_id
       WHERE s.consumer_number = ? AND s.tenant_id = ?
         AND s.deleted_at IS NULL AND t.deleted_at IS NULL
       LIMIT 1`,
      [consumerNumber, req.tenantId]
    );
    if (!students.length || students[0].status !== 'active') {
      return res.json({ data: { found: false, status: 'not_found', message: 'Consumer number not found' } });
    }

    const student = students[0];
    const [invoices] = await pool.query(
      `SELECT invoice_number, amount, due_date
       FROM invoices
       WHERE consumer_number = ? AND tenant_id = ? AND status != 'paid' AND deleted_at IS NULL
       ORDER BY due_date ASC`,
      [consumerNumber, req.tenantId]
    );
    const [[ledger]] = await pool.query(
      `SELECT COALESCE(SUM(debit), 0) AS debit, COALESCE(SUM(credit), 0) AS credit
       FROM ledger_entries WHERE tenant_id = ? AND student_id = ?`,
      [req.tenantId, student.id]
    );
    const invoiceDue = invoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0);
    const ledgerDue = Math.max(0, Number(ledger.debit) - Number(ledger.credit));
    const amount = Math.round(Math.max(invoiceDue, ledgerDue) * 100) / 100;
    const oldest = invoices[0] || null;
    const overdue = invoices.some((invoice) => invoice.due_date && new Date(`${invoice.due_date}T23:59:59Z`) < new Date());

    return res.json({
      data: {
        found: true,
        studentId: student.id,
        studentName: student.name,
        className: student.class,
        section: student.section,
        billId: student.bill_id,
        consumerNumber: student.consumer_number,
        invoiceNumber: oldest?.invoice_number || null,
        amount,
        dueDate: oldest?.due_date || null,
        status: amount === 0 ? 'paid' : overdue ? 'overdue' : 'unpaid',
        pendingCount: invoices.length,
        billerCode: student.biller_code,
        billerName: student.biller_name,
        currency: 'PKR',
        message: amount > 0 ? `${invoices.length} unpaid invoice(s) — total ${amount} PKR` : 'No outstanding balance',
      },
    });
  } catch (err) {
    next(err);
  }
};

/** Internal payment endpoint delegates to the same atomic posting service as 1LINK. */
const postBillPayment = async (req, res, next) => {
  try {
    const { consumerNumber, amount, transactionId, paidAt, channel, voucherNumber, notes } = req.body;
    const result = await postPayment({
      tenantId: req.tenantId,
      targetType: 'invoice',
      consumerNumber: consumerNumber.trim(),
      amount: Number(amount),
      receivedAt: paidAt,
      channel,
      externalReference: transactionId.trim(),
      transactionId: transactionId.trim(),
      idempotencyKey: req.headers['x-idempotency-key'] || transactionId.trim(),
      voucherNumber,
      note: notes || 'External billing API payment',
      source: 'saas_api',
      actorUserId: req.user?.id || null,
      actorName: req.user?.name || 'Billing API',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ data: result, message: 'Payment posted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { billInquiry, postBillPayment };
