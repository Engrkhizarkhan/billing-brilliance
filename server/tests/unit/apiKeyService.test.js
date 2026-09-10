const {
  generateApiKey,
  hashApiKey,
  decryptApiKey,
  validateApiKeyEncryptionKey,
} = require('../../src/services/apiKeyService');
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

  test('validates the configured encryption key length before startup', () => {
    expect(validateApiKeyEncryptionKey()).toBe(true);
    const original = config.apiKeyEncryptionKey;
    try {
      config.apiKeyEncryptionKey = 'replace_with_32_byte_base64_key';
      expect(() => validateApiKeyEncryptionKey()).toThrow('must decode to exactly 32 bytes');
    } finally {
      config.apiKeyEncryptionKey = original;
    }
  });
});
