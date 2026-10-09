const { AppError } = require('../middleware/errorHandler');
const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const MAX_PAYMENT_AMOUNT = 9999999999.99; // 1BILL N12 paisa field.
const assertMoney = (value, { allowZero = false, label = 'Amount' } = {}) => {
  if (!['string', 'number'].includes(typeof value) || !/^\d+(\.\d{1,2})?$/.test(String(value))
    || !Number.isFinite(Number(value)) || Number(value) > MAX_PAYMENT_AMOUNT
    || Number(value) < (allowZero ? 0 : 0.01)) {
    throw new AppError(`${label} must be ${allowZero ? 'zero or ' : ''}a positive PKR amount with at most two decimal places, up to ${MAX_PAYMENT_AMOUNT}`, 400, 'INVALID_AMOUNT');
  }
  return Number(value);
};
const pakistanDate = (at = new Date()) => new Date(new Date(at).getTime() + 5 * 3600000).toISOString().slice(0, 10);
const dueDayEnd = (date) => new Date(`${String(date).slice(0, 10)}T23:59:59.999+05:00`);
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value))
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const assertDate = (value) => {
  if (!validDate(value)) throw new AppError('Date must be a valid YYYY-MM-DD date', 400, 'INVALID_DATE');
  return value;
};
const dueInMonth = (month, day) => {
  const [year, mo] = month.split('-').map(Number);
  return `${month}-${String(Math.min(Math.max(Number(day) || 1, 1), new Date(Date.UTC(year, mo, 0)).getUTCDate())).padStart(2, '0')}`;
};
const computeNextDueDate = (assignedDate, dueDay) => {
  assertDate(assignedDate);
  let due = dueInMonth(assignedDate.slice(0, 7), dueDay);
  if (due < assignedDate) {
    const date = new Date(`${assignedDate}T00:00:00Z`);
    due = dueInMonth(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString().slice(0, 7), dueDay);
  }
  return due;
};
const billingDueDate = (assignment, month) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new AppError('Invalid billing month', 400, 'INVALID_BILLING_MONTH');
  const assigned = String(assignment.assigned_date || assignment.next_due_date || `${month}-01`).slice(0, 10);
  const anchor = String(assignment.next_due_date || computeNextDueDate(assigned, assignment.due_day)).slice(0, 10);
  const [year, mo] = month.split('-').map(Number);
  const [startYear, startMonth] = anchor.split('-').map(Number);
  const difference = (year - startYear) * 12 + mo - startMonth;
  const interval = { monthly: 1, quarterly: 3, yearly: 12, 'one-time': 0 }[assignment.frequency || 'monthly'];
  if (interval === undefined || difference < 0 || (interval === 0 ? difference !== 0 : difference % interval !== 0)) return null;
  const due = dueInMonth(month, assignment.due_day);
  return due < assigned || due < anchor ? null : due;
};
const lateFeeFor = (invoice, at = new Date()) => !invoice.late_fee_applied
  && dueDayEnd(invoice.due_date) < new Date(at)
  ? money(invoice.late_fee || 0) : 0;
const payableQuote = (invoices, ledger, at = new Date(), invoiceOnly = false) => {
  const invoiceDue = money(invoices.reduce((sum, row) => sum + Number(row.amount), 0));
  const ledgerDue = Math.max(0, money(Number(ledger.debit || 0) - Number(ledger.credit || 0)));
  const baseDue = invoiceOnly ? invoiceDue : Math.max(invoiceDue, ledgerDue);
  const lateFees = money(invoices.reduce((sum, row) => sum + lateFeeFor(row, at), 0));
  return { invoiceDue, ledgerDue, baseDue, lateFees, amount: money(baseDue + lateFees) };
};
const orgPayableQuote = (record, at = new Date()) => {
  const baseDue = money(record.amount);
  const lateFees = record.status === 'paid' ? money(Number(record.paid_amount ?? record.amount) - baseDue) : lateFeeFor(record, at);
  return { baseDue, lateFees, amount: money(baseDue + lateFees) };
};
module.exports = { money, assertMoney, MAX_PAYMENT_AMOUNT, pakistanDate, dueDayEnd, orgPayableQuote, validDate, assertDate, computeNextDueDate, billingDueDate, lateFeeFor, payableQuote };
