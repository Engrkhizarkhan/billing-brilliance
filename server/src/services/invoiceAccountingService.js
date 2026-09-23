const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { AppError } = require('../middleware/errorHandler');
const { money, assertDate } = require('./billingRules');

// All financial writers take the tenant lock first, then student/target locks.
// The caller owns the transaction so related assignment/registration writes join it.
const lockBillingTenant = async (connection, tenantId) => {
  const [[tenant]] = await connection.query(
    'SELECT id, status, lifecycle_stage FROM tenants WHERE id = ? AND deleted_at IS NULL FOR UPDATE', [tenantId]);
  if (!tenant) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
  if (tenant.status !== 'active') throw new AppError('Biller is suspended', 403, 'TENANT_SUSPENDED');
  if (config.appEnvironment !== 'sandbox' && tenant.lifecycle_stage !== 'live') {
    throw new AppError('Biller is not activated for production billing', 403, 'TENANT_NOT_LIVE');
  }
};

const createInvoiceCharges = async (connection, tenantId, charges) => {
  if (!charges.length) return [];
  const ids = [...new Set(charges.map((charge) => charge.studentId))];
  const [students] = await connection.query(
    "SELECT id, name, consumer_number FROM students WHERE tenant_id = ? AND id IN (?) AND status = 'active' AND deleted_at IS NULL FOR UPDATE", [tenantId, ids]);
  const byId = new Map(students.map((student) => [student.id, student]));
  if (byId.size !== ids.length) throw new AppError('Active student not found', 404, 'STUDENT_NOT_FOUND');
  const [totals] = await connection.query(
    'SELECT student_id, COALESCE(SUM(debit-credit), 0) AS balance FROM ledger_entries WHERE tenant_id = ? AND student_id IN (?) GROUP BY student_id', [tenantId, ids]);
  const balances = new Map(totals.map((row) => [row.student_id, money(row.balance)]));
  const [[sequence]] = await connection.query(
    "SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(invoice_number, '-', -1) AS UNSIGNED)), 10000) AS max_seq FROM invoices WHERE tenant_id = ?", [tenantId]);
  let counter = Number(sequence.max_seq);
  const invoices = [], ledger = [], result = [];
  for (const charge of charges) {
    assertDate(charge.dueDate);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(charge.month)) throw new AppError('Invalid billing month', 400, 'INVALID_BILLING_MONTH');
    const components = charge.components || [{ description: charge.description || 'Invoice charge', amount: charge.amount }];
    if (components.some((part) => !Number.isFinite(Number(part.amount)) || Number(part.amount) < 0)) throw new AppError('Invalid charge amount', 400, 'INVALID_AMOUNT');
    const amount = money(components.reduce((sum, part) => sum + money(part.amount), 0));
    const student = byId.get(charge.studentId);
    const id = uuidv4(), invoiceNumber = `INV-${++counter}`;
    invoices.push([id, tenantId, invoiceNumber, student.id, charge.feePlanId || null, student.name, student.consumer_number,
      charge.month, amount, money(charge.lateFee || 0), amount === 0 ? 'paid' : 'pending', charge.dueDate]);
    for (const part of components) {
      const balance = money((balances.get(student.id) || 0) + money(part.amount));
      balances.set(student.id, balance);
      ledger.push([uuidv4(), tenantId, student.id, charge.dueDate, part.description, money(part.amount), 0, balance,
        invoiceNumber, invoiceNumber, 'charge', part.grossTuition ?? null, part.scholarshipDiscount ?? null, part.netTuition ?? null]);
    }
    result.push({ id, invoiceNumber, amount, dueDate: charge.dueDate, studentId: student.id });
  }
  await connection.query(`INSERT INTO invoices
    (id, tenant_id, invoice_number, student_id, fee_plan_id, student_name, consumer_number, month, amount, late_fee, status, due_date) VALUES ?`, [invoices]);
  await connection.query(`INSERT INTO ledger_entries
    (id, tenant_id, student_id, date, description, debit, credit, balance, bill_id, reference, entry_type, gross_tuition, scholarship_discount, net_tuition) VALUES ?`, [ledger]);
  await connection.query(`UPDATE students s JOIN
    (SELECT student_id, SUM(debit-credit) AS balance FROM ledger_entries WHERE tenant_id = ? AND student_id IN (?) GROUP BY student_id) l ON l.student_id = s.id
    SET s.balance = l.balance WHERE s.tenant_id = ?`, [tenantId, ids, tenantId]);
  return result;
};
module.exports = { lockBillingTenant, createInvoiceCharges };
