const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { AppError } = require('../middleware/errorHandler');
const { auditLog } = require('../middleware/auditLog');

const FINTECH_PREFIX = config.fintechPrefix || '123456';

// ---- Bill Inquiry (1LINK-style) ----
const billInquiry = async (req, res, next) => {
  try {
    const { consumerNumber, voucherNumber, billerCode } = req.body;

    // Find student by consumer number
    const [studentRows] = await pool.query(
      'SELECT s.*, t.biller_code, t.name as biller_name FROM students s JOIN tenants t ON s.tenant_id = t.id WHERE s.consumer_number = ? AND s.deleted_at IS NULL',
      [consumerNumber.trim()]
    );

    if (studentRows.length === 0) {
      return res.json({ data: { found: false, status: 'not_found', message: 'Consumer number not found' } });
    }

    const student = studentRows[0];

    // Fetch ALL unpaid invoices and sum them for consolidated billing
    const [unpaidInvoices] = await pool.query(
      "SELECT * FROM invoices WHERE consumer_number = ? AND status != 'paid' AND deleted_at IS NULL ORDER BY due_date ASC",
      [consumerNumber.trim()]
    );

    const totalAmount = parseFloat(
      unpaidInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0).toFixed(2)
    );
    const oldestInvoice = unpaidInvoices[0] || null;
    const pendingCount = unpaidInvoices.length;
    const now = new Date();
    const hasOverdue = unpaidInvoices.some((inv) => inv.due_date && new Date(inv.due_date) < now);

    const response = {
      found: true,
      studentId: student.id,
      studentName: student.name,
      className: student.class,
      section: student.section,
      billId: student.bill_id,
      consumerNumber: student.consumer_number,
      invoiceNumber: oldestInvoice?.invoice_number || null,
      amount: totalAmount,
      dueDate: oldestInvoice?.due_date || null,
      status: totalAmount === 0 ? 'paid' : (hasOverdue ? 'overdue' : 'unpaid'),
      pendingCount,
      billerCode: student.biller_code,
      billerName: student.biller_name,
      currency: 'PKR',
      message: pendingCount > 0
        ? `${pendingCount} unpaid invoice(s) — total ${totalAmount} PKR`
        : 'No outstanding balance',
    };

    res.json({ data: response });
  } catch (err) {
    next(err);
  }
};

// ---- Bill Payment Posting ----
const postBillPayment = async (req, res, next) => {
  try {
    const { consumerNumber, amount, transactionId, paidAt, channel, voucherNumber, notes } = req.body;

    // Find student
    const [studentRows] = await pool.query(
      'SELECT s.*, t.biller_code, t.name as biller_name, t.id as tenant_id FROM students s JOIN tenants t ON s.tenant_id = t.id WHERE s.consumer_number = ? AND s.deleted_at IS NULL',
      [consumerNumber.trim()]
    );

    if (studentRows.length === 0) {
      return res.json({
        data: {
          receiptNumber: 'N/A',
          status: 'unpaid',
          amount,
          paidAt,
          consumerNumber,
          reference: transactionId,
          notes: 'Bill not found',
        },
        message: 'Bill not found',
      });
    }

    const student = studentRows[0];
    const tenantId = student.tenant_id;

    // Get first unpaid invoice for receipt reference (if any)
    const [firstUnpaid] = await pool.query(
      "SELECT invoice_number FROM invoices WHERE consumer_number = ? AND status != 'paid' AND deleted_at IS NULL ORDER BY due_date ASC LIMIT 1",
      [consumerNumber.trim()]
    );
    const invoiceRef = (firstUnpaid[0]?.invoice_number) || voucherNumber || null;

    // Record payment
    const paymentId = uuidv4();
    const receiptNumber = `RCPT-${Date.now()}`;
    await pool.query(
      `INSERT INTO payments (id, tenant_id, student_id, consumer_number, amount, date, reference, voucher_number, channel, receipt_number, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [paymentId, tenantId, student.id, consumerNumber.trim(), amount, paidAt, transactionId, voucherNumber || null, channel, receiptNumber, notes || null]
    );

    // Record transaction
    const txnId = uuidv4();
    await pool.query(
      `INSERT INTO transactions (id, tenant_id, transaction_id, consumer_number, amount, status, date, biller_name, channel, reference, notes)
       VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?)`,
      [txnId, tenantId, transactionId, consumerNumber.trim(), amount, paidAt, student.biller_name, channel, transactionId, notes || null]
    );

    // Apply payment to invoices oldest-first; only mark an invoice paid if fully covered
    const [unpaidInvoices] = await pool.query(
      "SELECT id, student_id, amount, due_date, late_fee, late_fee_applied, month FROM invoices WHERE consumer_number = ? AND status != 'paid' AND deleted_at IS NULL ORDER BY due_date ASC",
      [consumerNumber.trim()]
    );

    let remaining = parseFloat(amount);
    for (const inv of unpaidInvoices) {
      const invAmount = parseFloat(inv.amount);
      if (remaining >= invAmount) {
        await pool.query(
          "UPDATE invoices SET status = 'paid', paid_at = NOW() WHERE id = ?",
          [inv.id]
        );
        remaining = parseFloat((remaining - invAmount).toFixed(2));

        // Apply late fee if payment was received after the due date
        const lateFeeAmt = parseFloat(inv.late_fee || 0);
        const paymentDate = new Date(paidAt);
        const dueDate = new Date(inv.due_date);
        if (lateFeeAmt > 0 && paymentDate > dueDate && !inv.late_fee_applied) {
          const lateFeeEntryId = uuidv4();
          const monthLabel = inv.month || inv.due_date.slice(0, 7);
          await pool.query(
            `INSERT INTO ledger_entries (id, tenant_id, student_id, date, description, debit, credit, balance, reference, entry_type)
             VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'late_fee')`,
            [lateFeeEntryId, tenantId, inv.student_id, paidAt,
             `Late Fee — ${monthLabel}`, lateFeeAmt, lateFeeAmt, transactionId]
          );
          await pool.query('UPDATE invoices SET late_fee_applied = 1 WHERE id = ?', [inv.id]);
        }
      } else {
        break; // partial — leave this and remaining invoices unpaid
      }
    }

    // Re-query outstanding after applying payment
    const [afterRows] = await pool.query(
      "SELECT COALESCE(SUM(amount),0) as still_due FROM invoices WHERE consumer_number = ? AND status != 'paid' AND deleted_at IS NULL",
      [consumerNumber.trim()]
    );
    const stillDue = parseFloat(afterRows[0].still_due);
    const fullyPaid = stillDue === 0;

    // Create ledger payment entry
    await pool.query(
      `INSERT INTO ledger_entries (id, tenant_id, student_id, date, description, debit, credit, balance, bill_id, reference, entry_type)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'payment')`,
      [uuidv4(), tenantId, student.id, paidAt,
       `Payment received via ${channel}`, amount, amount,
       invoiceRef, transactionId]
    );

    await auditLog(req, 'payment', 'bill_payment', paymentId, `Payment ${amount} PKR via ${channel} for ${consumerNumber}`);

    res.json({
      data: {
        receiptNumber,
        status: fullyPaid ? 'paid' : 'partial',
        amount,
        remainingBalance: stillDue,
        paidAt,
        consumerNumber,
        reference: transactionId,
        invoiceNumber: invoiceRef,
        studentId: student.id,
        billId: student.bill_id,
        billerName: student.biller_name,
        notes,
      },
      message: fullyPaid ? 'Payment posted successfully' : `Payment of ${amount} PKR applied — ${stillDue} PKR still outstanding`,
    });
  } catch (err) {
    next(err);
  }
};

// ---- Fetch Bundles ----
const fetchBundles = async (req, res, next) => {
  try {
    const companyId = (req.body?.PCID || req.body?.pcid || config.onebill.bankMnemonic || 'MBLINK01').toString();
    let where = 'WHERE 1=1';
    const params = [];
    if (req.tenantId) { where += ' AND tenant_id = ?'; params.push(req.tenantId); }

    const [rows] = await pool.query(`SELECT * FROM bill_bundles ${where} ORDER BY name`, params);

    let billerName = 'FinBill Platform';
    if (req.tenantId) {
      const [tenantRows] = await pool.query('SELECT name FROM tenants WHERE id = ? LIMIT 1', [req.tenantId]);
      if (tenantRows.length > 0) {
        billerName = tenantRows[0].name;
      }
    }

    const bundleDetails = rows.map((row) => ({
      bundleId: row.code || row.id,
      bundleName: row.name,
      description: row.description || '',
      expiryDate: '',
      amount: String(parseFloat(row.amount || 0)),
      tag: `Category:${row.frequency || ''};Validity:${row.frequency || ''};DueDay:${row.due_day ?? ''};LateFee:${parseFloat(row.late_fee || 0)}`,
    }));

    res.json({
      data: {
        companyId,
        responseCode: '00',
        billerName,
        bundleDetails,
      },
      message: 'Bundles fetched',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { billInquiry, postBillPayment, fetchBundles };
