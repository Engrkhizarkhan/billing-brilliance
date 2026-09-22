import { describe, expect, it } from 'vitest';
import { encodeCsv, parseCsv } from './csv';
describe('CSV exchange', () => {
  it('preserves commas, quotes and multiline cells', () => {
    const rows = [{ Name: 'Ali, Ahmed', Note: 'Line 1\n"Line 2"' }];
    expect(parseCsv(encodeCsv(rows))).toEqual([['Name','Note'],['Ali, Ahmed','Line 1\n"Line 2"']]);
  });
  it('escapes spreadsheet formula cells', () => {
    expect(parseCsv(encodeCsv([{ Name: '=1+1', Note: '@SUM(A1)' }]))[1]).toEqual(["'=1+1", "'@SUM(A1)"]);
  });
  it('rejects malformed quoted input', () => {
    expect(() => parseCsv('Name,Note\n"Unclosed,test')).toThrow('Invalid CSV');
  });
});
