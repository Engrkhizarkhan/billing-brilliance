const { billingDueDate, validDate, computeNextDueDate, payableQuote } = require('../../src/services/billingRules');
test('calendar validation and month-end due days handle leap years', () => {
  expect(validDate('2026-02-29')).toBe(false);
  expect(validDate('2028-02-29')).toBe(true);
  expect(computeNextDueDate('2026-02-01',31)).toBe('2026-02-28');
  expect(computeNextDueDate('2026-12-31',5)).toBe('2027-01-05');
});
test.each([['monthly','2026-02','2026-02-15'],['quarterly','2026-02',null],['quarterly','2026-04','2026-04-15'],['yearly','2026-04',null],['yearly','2027-01','2027-01-15'],['one-time','2026-01','2026-01-15'],['one-time','2027-01',null]])('%s frequency in %s', (frequency,month,due) => {
  expect(billingDueDate({assigned_date:'2026-01-01',next_due_date:'2026-01-15',due_day:15,frequency},month)).toBe(due);
});
test('quote uses complete ledger balance and adds a late fee only after UTC due-day end', () => {
  const invoices=[{amount:100,due_date:'2026-09-01',late_fee:10,late_fee_applied:0}];
  expect(payableQuote(invoices,{debit:150,credit:0},'2026-09-01T23:59:59Z').amount).toBe(150);
  expect(payableQuote(invoices,{debit:150,credit:0},'2026-09-02T00:00:00Z').amount).toBe(160);
});
