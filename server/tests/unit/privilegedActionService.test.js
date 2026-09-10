const config = require('../../src/config');
const { pinMatches } = require('../../src/services/privilegedActionService');

describe('privileged administrator PIN', () => {
  test('accepts only the configured six-digit PIN', () => {
    expect(pinMatches(config.admin.actionPin)).toBe(true);
    expect(pinMatches('000000')).toBe(config.admin.actionPin === '000000');
    expect(pinMatches('12345')).toBe(false);
    expect(pinMatches('1234567')).toBe(false);
    expect(pinMatches('secret')).toBe(false);
  });
});
