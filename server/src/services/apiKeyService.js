const crypto = require('crypto');
const config = require('../config');

const hashApiKey = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const getEncryptionKey = () => {
  const configured = String(config.apiKeyEncryptionKey || '').trim();
  let key;
  if (/^[a-f0-9]{64}$/i.test(configured)) key = Buffer.from(configured, 'hex');
  else key = Buffer.from(configured, 'base64');
  if (key.length !== 32) throw new Error('API_KEY_ENCRYPTION_KEY must decode to exactly 32 bytes');
  return key;
};

const encryptApiKey = (secret) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(secret), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
};

const decryptApiKey = (envelope) => {
  const [version, iv, tag, ciphertext] = String(envelope || '').split('.');
  if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('Encrypted API key is unavailable or invalid');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
};

const generateApiKey = () => {
  const scope = config.appEnvironment === 'sandbox' ? 'test' : 'live';
  const secret = `fintap_${scope}_${crypto.randomBytes(24).toString('hex')}`;
  return { secret, hash: hashApiKey(secret), prefix: secret.slice(0, 18), scope, encrypted: encryptApiKey(secret) };
};

module.exports = { hashApiKey, generateApiKey, encryptApiKey, decryptApiKey };
