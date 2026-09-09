const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const config = require('../config');
const { AppError } = require('../middleware/errorHandler');

const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const mysqlDateTime = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new AppError('Invalid received date/time', 400, 'INVALID_RECEIVED_AT');
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

const assertTenantCanCollect = async (connection, tenantId, source) => {
  const [rows] = await connection.query(
    `SELECT id, name, status, lifecycle_stage FROM tenants
     WHERE id = ? AND deleted_at IS NULL FOR UPDATE`, [tenantId]
  );
  if (!rows.length) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
  const tenant = rows[0];
  if (tenant.status !== 'active') throw new AppError('Biller is suspended', 403, 'TENANT_SUSPENDED');
  if (config.appEnvironment === 'production' && source !== 'sandbox_simulator' && tenant.lifecycle_stage !== 'live') {
    throw new AppError('Biller is not activated for production collections', 403, 'TENANT_NOT_LIVE');
  }
  return tenant;
};

const findDuplicate = async (connection, tenantId, reference, idempotencyKey) => {
  const clauses = [];
  const params = [tenantId];
  if (reference) { clauses.push('reference = ?'); params.push(reference); }
  if (idempotencyKey) { clauses.push('idempotency_key = ?'); params.push(idempotencyKey); }
  if (!clauses.length) return null;
  const [rows] = await connection.query(
    `SELECT * FROM payments WHERE tenant_id = ? AND (${clauses.join(' OR ')}) LIMIT 1 FOR UPDATE`, params
  );
  return rows[0] || null;
};

const insertEvidence = async (connection, input, tenant, paymentId, receiptNumber, consumerNumber, amount, paidAt, billerName) => {
  const date = paidAt.slice(0, 10);
  await connection.query(
    `INSERT INTO payments
     (id, tenant_id, student_id, consumer_number, amount, date, reference, voucher_number,
      channel, receipt_number, note, source, status, received_at, created_by_user_id,
      idempotency_key, currency)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'posted', ?, ?, ?, ?)`,
    [paymentId, input.tenantId, input.studentId || null, consumerNumber, amount, date,
      input.externalReference, input.voucherNumber || null, input.channel, receiptNumber,
      input.note || null, input.source, paidAt, input.actorUserId || null,
      input.idempotencyKey || null, input.currency || 'PKR']
  );

  await connection.query(
    `INSERT INTO transactions
     (id, tenant_id, transaction_id, consumer_number, amount, status, date, biller_name, channel, reference, notes)
     VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?)`,
    [uuidv4(), input.tenantId, input.externalReference, consumerNumber,
      amount, date, billerName || tenant.name, input.channel, input.externalReference, input.note || null]
  );
};

const insertTransactionalAudit = async (connection, input, paymentId, amount, consumerNumber) => {
  await connection.query(
    `INSERT INTO audit_logs
     (id, tenant_id, user_id, user_name, action, entity, entity_id, details, ip_address, user_agent)
     VALUES (?, ?, ?, ?, 'payment', 'payment', ?, ?, ?, ?)`,
    [uuidv4(), input.tenantId, input.actorUserId || null, input.actorName || 'System', paymentId,
      `${input.source} payment PKR ${amount.toFixed(2)} for ${consumerNumber}; reason=${input.note || 'n/a'}`,
      input.ipAddress || null, input.userAgent || null]
  );
  await connection.query(
    `INSERT INTO outbox_events
     (id, tenant_id, event_type, aggregate_type, aggregate_id, payload)
     VALUES (?, ?, 'payment.posted', 'payment', ?, ?)`,
    [uuidv4(), input.tenantId, paymentId, JSON.stringify({
      paymentId, consumerNumber, amount, currency: input.currency || 'PKR',
      source: input.source, reference: input.externalReference,
      transactionId: input.transactionId || input.externalReference,
      receivedAt: input.receivedAt || null, targetType: input.targetType,
    })]
  );
};

const postOrgPayment = async (connection, input, tenant, paidAt) => {
  const params = [input.tenantId];
  let selector = '';
  if (input.orgPaymentId) { selector = 'opr.id = ?'; params.push(input.orgPaymentId); }
  else { selector = 'opr.consumer_number = ?'; params.push(input.consumerNumber); }
  const [rows] = await connection.query(
    `SELECT opr.* FROM org_payment_records opr
     WHERE opr.tenant_id = ? AND ${selector} FOR UPDATE`, params
  );
  if (!rows.length) throw new AppError('Payment request not found', 404, 'BILL_NOT_FOUND');
  const record = rows[0];
  if (record.status === 'paid') throw new AppError('Bill is already paid', 409, 'ALREADY_PAID');
  if (record.status !== 'pending') throw new AppError('Bill is not payable', 409, 'BILL_NOT_PAYABLE');
  if (record.expiry_date && new Date(`${String(record.expiry_date).replace(' ', 'T')}Z`) <= new Date(paidAt.replace(' ', 'T') + 'Z')) {
    throw new AppError('Bill has expired', 409, 'BILL_EXPIRED');
  }
  const expected = money(record.amount);
  const received = money(input.amount);
  if (received !== expected) throw new AppError(`Exact payment of PKR ${expected.toFixed(2)} is required`, 422, 'AMOUNT_MISMATCH');

  const paymentId = uuidv4();
  const receiptNumber = `RCPT-${Date.now()}-${paymentId.slice(0, 6).toUpperCase()}`;
  await insertEvidence(connection, { ...input, studentId: null }, tenant, paymentId, receiptNumber,
    record.consumer_number, received, paidAt, tenant.name);
  await connection.query(
    `UPDATE org_payment_records SET status = 'paid', transaction_id = ?, paid_at = ?
     WHERE id = ? AND tenant_id = ?`,
    [input.transactionId || input.externalReference, paidAt, record.id, input.tenantId]
  );
  await connection.query(
    `INSERT INTO payment_allocations (id, tenant_id, payment_id, target_type, target_id, amount)
     VALUES (?, ?, ?, 'org_payment', ?, ?)`,
    [uuidv4(), input.tenantId, paymentId, record.id, received]
  );
  await connection.query(
    `INSERT INTO org_payment_notifications (id, tenant_id, application_id, payment_id, bill_id, status)
     VALUES (?, ?, ?, ?, ?, 'paid')`,
    [uuidv4(), input.tenantId, record.application_id, record.id, record.bill_id]
  );
  await insertTransactionalAudit(connection, input, paymentId, received, record.consumer_number);
  return { paymentId, receiptNumber, consumerNumber: record.consumer_number, amount: received,
    remainingBalance: 0, status: 'paid', paidAt, reference: input.externalReference,
    targetType: 'org_payment', targetId: record.id };
};

const postStudentPayment = async (connection, input, tenant, paidAt) => {
  const [students] = await connection.query(
    `SELECT * FROM students WHERE tenant_id = ? AND consumer_number = ?
     AND deleted_at IS NULL FOR UPDATE`, [input.tenantId, input.consumerNumber]
  );
  if (!students.length) throw new AppError('Consumer number not found', 404, 'BILL_NOT_FOUND');
  const student = students[0];
  if (student.status !== 'active') throw new AppError('Consumer is blocked', 409, 'CONSUMER_BLOCKED');

  const invoiceParams = [input.tenantId, student.consumer_number];
  let invoiceFilter = '';
  if (input.invoiceId) { invoiceFilter = ' AND id = ?'; invoiceParams.push(input.invoiceId); }
  const [invoices] = await connection.query(
    `SELECT * FROM invoices WHERE tenant_id = ? AND consumer_number = ?
     AND status != 'paid' AND deleted_at IS NULL${invoiceFilter}
     ORDER BY due_date ASC FOR UPDATE`, invoiceParams
  );
  if (input.invoiceId && !invoices.length) throw new AppError('Invoice is already paid or not found', 409, 'ALREADY_PAID');

  const paidDate = new Date(`${paidAt.replace(' ', 'T')}Z`);
  const baseDue = money(invoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0));
  const [[prePaymentTotals]] = await connection.query(
    `SELECT COALESCE(SUM(debit),0) AS debit, COALESCE(SUM(credit),0) AS credit
     FROM ledger_entries WHERE tenant_id = ? AND student_id = ?`, [input.tenantId, student.id]
  );
  const ledgerOutstanding = Math.max(0, money(Number(prePaymentTotals.debit) - Number(prePaymentTotals.credit)));
  if (!invoices.length && ledgerOutstanding === 0) {
    throw new AppError('Bill is already paid or not found', 409, 'ALREADY_PAID');
  }
  const lateFees = money(invoices.reduce((sum, invoice) => (
    sum + (!invoice.late_fee_applied && new Date(`${invoice.due_date}T23:59:59Z`) < paidDate ? Number(invoice.late_fee || 0) : 0)
  ), 0));
  const payableBase = input.invoiceId ? baseDue : Math.max(baseDue, ledgerOutstanding);
  const expected = money(payableBase + lateFees);
  const received = money(input.amount);
  if (received !== expected) throw new AppError(`Exact payment of PKR ${expected.toFixed(2)} is required`, 422, 'AMOUNT_MISMATCH');

  const paymentId = uuidv4();
  const receiptNumber = `RCPT-${Date.now()}-${paymentId.slice(0, 6).toUpperCase()}`;
  await insertEvidence(connection, { ...input, studentId: student.id }, tenant, paymentId, receiptNumber,
    student.consumer_number, received, paidAt, tenant.name);

  let runningBalance = ledgerOutstanding;
  for (const invoice of invoices) {
    const invoiceAmount = money(invoice.amount);
    const isLate = !invoice.late_fee_applied && new Date(`${invoice.due_date}T23:59:59Z`) < paidDate;
    const lateFee = isLate ? money(invoice.late_fee || 0) : 0;
    if (lateFee > 0) {
      runningBalance = money(runningBalance + lateFee);
      await connection.query(
        `INSERT INTO ledger_entries
         (id, tenant_id, student_id, date, description, debit, credit, balance, bill_id, reference, entry_type)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'late_fee')`,
        [uuidv4(), input.tenantId, student.id, paidAt.slice(0, 10),
          `Late Fee — ${invoice.month || invoice.due_date}`, lateFee, runningBalance,
          invoice.invoice_number, input.externalReference]
      );
      await connection.query(
        `INSERT INTO payment_allocations (id, tenant_id, payment_id, target_type, target_id, amount)
         VALUES (?, ?, ?, 'ledger_charge', ?, ?)`,
        [uuidv4(), input.tenantId, paymentId, invoice.id, lateFee]
      );
    }
    await connection.query(
      `UPDATE invoices SET status = 'paid', paid_at = ?, late_fee_applied = ?
       WHERE id = ? AND tenant_id = ?`,
      [paidAt, lateFee > 0 || invoice.late_fee_applied ? 1 : 0, invoice.id, input.tenantId]
    );
    await connection.query(
      `INSERT INTO payment_allocations (id, tenant_id, payment_id, target_type, target_id, amount)
       VALUES (?, ?, ?, 'invoice', ?, ?)`,
      [uuidv4(), input.tenantId, paymentId, invoice.id, invoiceAmount]
    );
  }
  const ledgerOnlyAmount = money(payableBase - baseDue);
  if (ledgerOnlyAmount > 0) {
    await connection.query(
      `INSERT INTO payment_allocations (id, tenant_id, payment_id, target_type, target_id, amount)
       VALUES (?, ?, ?, 'ledger_charge', ?, ?)`,
      [uuidv4(), input.tenantId, paymentId, student.id, ledgerOnlyAmount]
    );
  }
  runningBalance = Math.max(0, money(runningBalance - received));
  await connection.query(
    `INSERT INTO ledger_entries
     (id, tenant_id, student_id, date, description, debit, credit, balance, bill_id, reference, entry_type, allocations)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'payment', ?)`,
    [uuidv4(), input.tenantId, student.id, paidAt.slice(0, 10),
      `Payment received via ${input.channel}`, received, runningBalance,
      invoices[0]?.invoice_number || student.bill_id, input.externalReference,
      JSON.stringify(invoices.map((invoice) => ({ invoiceId: invoice.id, amount: money(invoice.amount) })))]
  );
  await connection.query('UPDATE students SET balance = ? WHERE id = ? AND tenant_id = ?',
    [runningBalance, student.id, input.tenantId]);
  await connection.query(
    `INSERT INTO notifications (id, tenant_id, user_id, title, message, type)
     VALUES (?, ?, NULL, 'Payment received', ?, 'payment')`,
    [uuidv4(), input.tenantId, `PKR ${received.toFixed(2)} received for ${student.name}`]
  );
  await insertTransactionalAudit(connection, input, paymentId, received, student.consumer_number);
  return { paymentId, receiptNumber, consumerNumber: student.consumer_number, amount: received,
    remainingBalance: runningBalance, status: runningBalance === 0 ? 'paid' : 'partial', paidAt,
    reference: input.externalReference, invoiceNumber: invoices[0]?.invoice_number || null,
    studentId: student.id, billId: student.bill_id, targetType: 'invoice' };
};

const postPayment = async (input) => {
  if (!input.tenantId) throw new AppError('Tenant is required', 400, 'TENANT_REQUIRED');
  if (!input.externalReference?.trim()) throw new AppError('External reference is required', 400, 'REFERENCE_REQUIRED');
  if (!input.note?.trim() && input.source === 'manual') throw new AppError('Reason is required for manual payments', 400, 'REASON_REQUIRED');
  if (!Number.isFinite(Number(input.amount)) || Number(input.amount) <= 0) throw new AppError('Amount must be greater than zero', 400, 'INVALID_AMOUNT');
  const paidAt = mysqlDateTime(input.receivedAt);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const tenant = await assertTenantCanCollect(connection, input.tenantId, input.source);
    const duplicate = await findDuplicate(connection, input.tenantId, input.externalReference.trim(), input.idempotencyKey);
    if (duplicate) throw new AppError('Payment reference or idempotency key has already been used', 409, 'DUPLICATE_PAYMENT');
    const normalized = { ...input, externalReference: input.externalReference.trim(), note: input.note?.trim() };
    const result = input.targetType === 'org_payment'
      ? await postOrgPayment(connection, normalized, tenant, paidAt)
      : await postStudentPayment(connection, normalized, tenant, paidAt);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

const reverseManualPayment = async (input) => {
  if (!input.tenantId) throw new AppError('Tenant is required', 400, 'TENANT_REQUIRED');
  if (!input.reason || input.reason.trim().length < 5) throw new AppError('A reversal reason is required', 400, 'REASON_REQUIRED');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT * FROM payments WHERE id = ? AND tenant_id = ? FOR UPDATE`,
      [input.paymentId, input.tenantId]
    );
    if (!rows.length) throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    const payment = rows[0];
    if (payment.status !== 'posted') throw new AppError('Payment has already been reversed or voided', 409, 'PAYMENT_ALREADY_REVERSED');
    if (payment.source !== 'manual' || payment.reversal_of_payment_id) {
      throw new AppError('Only manually recorded payments can be reversed here; external payments require settlement reconciliation', 409, 'EXTERNAL_REVERSAL_RESTRICTED');
    }
    if (input.confirmation !== payment.receipt_number) {
      throw new AppError('Type the exact receipt number to confirm reversal', 400, 'CONFIRMATION_REQUIRED');
    }
    const [existingReversal] = await connection.query(
      'SELECT id FROM payments WHERE reversal_of_payment_id = ? LIMIT 1 FOR UPDATE', [payment.id]
    );
    if (existingReversal.length) throw new AppError('Payment already has a reversal record', 409, 'PAYMENT_ALREADY_REVERSED');

    const [allocations] = await connection.query(
      'SELECT * FROM payment_allocations WHERE tenant_id = ? AND payment_id = ? FOR UPDATE',
      [input.tenantId, payment.id]
    );
    const reversalId = uuidv4();
    const reference = `REV-${reversalId.slice(0, 18).toUpperCase()}`;
    const receiptNumber = `REV-RCPT-${reversalId.slice(0, 8).toUpperCase()}`;
    const now = mysqlDateTime(new Date());
    const amount = money(payment.amount);

    await connection.query(
      `INSERT INTO payments
       (id, tenant_id, student_id, consumer_number, amount, date, reference, channel,
        receipt_number, note, source, status, received_at, created_by_user_id,
        idempotency_key, currency, reversal_of_payment_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'reversal', ?, ?, 'manual', 'posted', ?, ?, ?, ?, ?)`,
      [reversalId, input.tenantId, payment.student_id, payment.consumer_number, -amount,
        now.slice(0, 10), reference, receiptNumber, input.reason.trim(), now,
        input.actorUserId, reference, payment.currency || 'PKR', payment.id]
    );
    await connection.query(
      `UPDATE payments SET status = 'reversed' WHERE id = ? AND tenant_id = ?`,
      [payment.id, input.tenantId]
    );
    await connection.query(
      `INSERT INTO transactions
       (id, tenant_id, transaction_id, consumer_number, amount, status, date, biller_name, channel, reference, notes)
       VALUES (?, ?, ?, ?, ?, 'completed', ?, 'Fintap reversal', 'reversal', ?, ?)`,
      [uuidv4(), input.tenantId, reference, payment.consumer_number, -amount,
        now.slice(0, 10), reference, input.reason.trim()]
    );

    for (const allocation of allocations) {
      if (allocation.target_type === 'invoice') {
        await connection.query(
          `UPDATE invoices SET status = 'pending', paid_at = NULL WHERE id = ? AND tenant_id = ?`,
          [allocation.target_id, input.tenantId]
        );
      } else if (allocation.target_type === 'org_payment') {
        await connection.query(
          `UPDATE org_payment_records
           SET status = CASE WHEN expiry_date <= UTC_TIMESTAMP() THEN 'expired' ELSE 'pending' END,
               paid_at = NULL, transaction_id = NULL
           WHERE id = ? AND tenant_id = ?`,
          [allocation.target_id, input.tenantId]
        );
      }
    }

    if (payment.student_id) {
      const [balances] = await connection.query(
        `SELECT balance FROM ledger_entries WHERE tenant_id = ? AND student_id = ?
         ORDER BY date DESC, created_at DESC LIMIT 1 FOR UPDATE`,
        [input.tenantId, payment.student_id]
      );
      const balance = money(Number(balances[0]?.balance || 0) + amount);
      await connection.query(
        `INSERT INTO ledger_entries
         (id, tenant_id, student_id, date, description, debit, credit, balance, reference, entry_type)
         VALUES (?, ?, ?, ?, 'Manual payment reversal', ?, 0, ?, ?, 'adjustment')`,
        [uuidv4(), input.tenantId, payment.student_id, now.slice(0, 10), amount, balance, reference]
      );
      await connection.query('UPDATE students SET balance = ? WHERE id = ? AND tenant_id = ?',
        [balance, payment.student_id, input.tenantId]);
    }

    await connection.query(
      `INSERT INTO audit_logs
       (id, tenant_id, user_id, user_name, action, entity, entity_id, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, 'reverse', 'payment', ?, ?, ?, ?)`,
      [uuidv4(), input.tenantId, input.actorUserId, input.actorName || 'Administrator', payment.id,
        `Manual payment reversed by ${reference}; reason=${input.reason.trim()}`,
        input.ipAddress || null, input.userAgent || null]
    );
    await connection.query(
      `INSERT INTO outbox_events (id, tenant_id, event_type, aggregate_type, aggregate_id, payload)
       VALUES (?, ?, 'payment.reversed', 'payment', ?, ?)`,
      [uuidv4(), input.tenantId, payment.id, JSON.stringify({
        paymentId: payment.id, reversalPaymentId: reversalId, consumerNumber: payment.consumer_number,
        amount, currency: payment.currency || 'PKR', reference, reason: input.reason.trim(),
      })]
    );
    await connection.commit();
    return { paymentId: payment.id, reversalPaymentId: reversalId, reference, receiptNumber, amount, status: 'reversed' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = { postPayment, reverseManualPayment, money, mysqlDateTime };
