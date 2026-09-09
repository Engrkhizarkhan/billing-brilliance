jest.mock('../../src/config/database', () => ({ pool: {} }));
const { money, mysqlDateTime } = require('../../src/services/paymentPostingService');

describe('payment posting primitives', () => {
  test('rounds monetary values to two decimal places', () => {
    expect(money(10.005)).toBe(10.01);
    expect(money('2500')).toBe(2500);
  });

  test('normalizes received timestamps for MySQL', () => {
    expect(mysqlDateTime('2026-09-08T10:11:12.000Z')).toBe('2026-09-08 10:11:12');
  });

  test('rejects invalid received timestamps', () => {
    expect(() => mysqlDateTime('not-a-date')).toThrow('Invalid received date/time');
  });
});
