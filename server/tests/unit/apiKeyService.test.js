const { generateApiKey, hashApiKey, decryptApiKey } = require('../../src/services/apiKeyService');
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
    expect(key.encrypted).not.toContain(key.secret);
    expect(decryptApiKey(key.encrypted)).toBe(key.secret);
  });

  test('rejects tampered encrypted API-key material', () => {
    const key = generateApiKey();
    expect(() => decryptApiKey(`${key.encrypted.slice(0, -1)}x`)).toThrow();
  });
});
