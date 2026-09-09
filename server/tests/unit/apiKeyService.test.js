const { generateApiKey, hashApiKey } = require('../../src/services/apiKeyService');
const config = require('../../src/config');

describe('API key storage', () => {
  test('generates a one-time secret and stable non-secret hash', () => {
    const key = generateApiKey();
    const expectedScope = config.appEnvironment === 'sandbox' ? 'test' : 'live';
    expect(key.secret).toMatch(new RegExp(`^fintap_${expectedScope}_`));
    expect(key.scope).toBe(expectedScope);
    expect(key.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashApiKey(key.secret)).toBe(key.hash);
    expect(key.prefix).not.toBe(key.secret);
  });
});
