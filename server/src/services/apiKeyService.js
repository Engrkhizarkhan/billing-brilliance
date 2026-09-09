const crypto = require('crypto');
const config = require('../config');

const hashApiKey = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const generateApiKey = () => {
  const scope = config.appEnvironment === 'sandbox' ? 'test' : 'live';
  const secret = `fintap_${scope}_${crypto.randomBytes(24).toString('hex')}`;
  return { secret, hash: hashApiKey(secret), prefix: secret.slice(0, 18), scope };
};

module.exports = { hashApiKey, generateApiKey };
