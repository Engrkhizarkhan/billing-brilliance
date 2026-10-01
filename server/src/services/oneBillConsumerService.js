const config = require('../config');
const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

// 1BILL removes the fintech routing prefix before forwarding a consumer number.
// Resolve it at the provider boundary; accounting always uses the stored full number.
const resolveOneBillConsumer = async (number) => {
  const prefix = String(config.fintechPrefix || '');
  if (!/^\d{6}$/.test(prefix)) {
    throw new AppError('Invalid 1BILL consumer namespace', 500, 'INVALID_CONSUMER_NAMESPACE');
  }
  const candidates = [];
  if (number.startsWith(prefix)) candidates.push(number);
  if (prefix.length + number.length <= 24) candidates.push(prefix + number);
  if (candidates.length < 2) return candidates[0] || null;

  // A shortened number can itself begin with the prefix. Do not guess which
  // account to charge when both interpretations exist, even if one is inactive.
  const [rows] = await pool.query(
    `SELECT consumer_number FROM students WHERE consumer_number IN (?, ?)
     UNION
     SELECT consumer_number FROM org_payment_records WHERE consumer_number IN (?, ?)`,
    [...candidates, ...candidates]
  );
  if (rows.length > 1) {
    throw new AppError('Ambiguous 1BILL consumer number', 400, 'AMBIGUOUS_CONSUMER_NUMBER');
  }
  return rows[0]?.consumer_number || candidates[0];
};

module.exports = { resolveOneBillConsumer };
