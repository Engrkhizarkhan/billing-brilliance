const crypto = require('crypto');
const config = require('../config');
const { AppError } = require('../middleware/errorHandler');
const { auditLog } = require('../middleware/auditLog');

const pinMatches = (provided) => {
  const expected = Buffer.from(String(config.admin.actionPin || ''), 'utf8');
  const actual = Buffer.from(String(provided || ''), 'utf8');
  return /^\d{6}$/.test(actual.toString('utf8'))
    && expected.length === actual.length
    && crypto.timingSafeEqual(expected, actual);
};

const requireAdminPin = async (req, entity, entityId, purpose) => {
  if (pinMatches(req.body?.pin)) return;
  await auditLog(req, 'pin_denied', entity, entityId, `Privileged action denied: ${purpose}`);
  throw new AppError('Invalid administrator PIN', 403, 'INVALID_ADMIN_PIN');
};

module.exports = { pinMatches, requireAdminPin };
