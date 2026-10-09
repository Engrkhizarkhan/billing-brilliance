const { orgBillingTerms } = require('../../src/services/orgBillingTerms');
const { assertMoney, orgPayableQuote } = require('../../src/services/billingRules');
const now = new Date('2026-10-09T12:00:00Z');
const terms = options => orgBillingTerms({ defaultHours: 48, ...options }, now);
test('explicit due date remains payable through its Pakistan calendar day', () => {
  expect(terms({dueDate:'2026-10-31'})).toEqual({dueDate:'2026-10-31',expiryDate:'2026-10-31 18:59:59'});
  expect(terms({})).toEqual({dueDate:'2026-10-11',expiryDate:'2026-10-11 12:00:00'});
});
test('neverExpires allows overdue collection and overrides expiry input', () => {
  expect(terms({dueDate:'2026-10-01',neverExpires:true,expireAt:'invalid'})).toEqual({dueDate:'2026-10-01',expiryDate:'9999-12-31 23:59:59'});
});
test.each([{dueDate:'2026-02-30'}, {dueDate:'2026-10-01'}, {expireAt:'2026-10-10'}, {expireAt:'2026-10-08T12:00:00Z'}, {dueDate:'2026-10-31',expireAt:'2026-10-30T12:00:00Z'}])('rejects invalid or contradictory dates %j', input => {
  expect(() => terms(input)).toThrow();
});
test.each([0,0.001,-1,10000000000,'1e2',true,null,'1.001'])('rejects uncollectible money %p', input => expect(() => assertMoney(input)).toThrow());
test('supports exact paisa and optional zero late fee', () => {
  expect(assertMoney('0.01')).toBe(0.01);
  expect(assertMoney(0,{allowZero:true})).toBe(0);
  expect(assertMoney('9999999999.99')).toBe(9999999999.99);
});
test('organization late fee starts at midnight Pakistan time, leaving base amount intact', () => {
  const record={amount:'100.00',late_fee:'20.50',due_date:'2026-10-09'};
  expect(orgPayableQuote(record,'2026-10-09T18:59:59Z').amount).toBe(100);
  expect(orgPayableQuote(record,'2026-10-09T19:00:00Z')).toEqual({baseDue:100,lateFees:20.5,amount:120.5});
});

test('a bill paid before its due date never acquires a late fee afterwards', () => {
  expect(orgPayableQuote({amount:100,late_fee:20,due_date:'2020-01-01',status:'paid',paid_amount:100}).amount).toBe(100);
  expect(orgPayableQuote({amount:100,late_fee:20,due_date:'2020-01-01',status:'paid',paid_amount:120}).amount).toBe(120);
});
