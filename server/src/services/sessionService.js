const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const replacePassword = async (userId, passwordHash, expectedHash, { includeDeleted = false } = {}) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[user]] = await connection.query(`SELECT password_hash FROM users WHERE id = ? ${includeDeleted ? '' : 'AND deleted_at IS NULL'} FOR UPDATE`, [userId]);
    if (!user || (expectedHash && user.password_hash !== expectedHash)) throw new AppError('Credentials changed; sign in and retry', 409, 'CREDENTIALS_CHANGED');
    await connection.query('UPDATE users SET password_hash = ?, auth_version = auth_version + 1 WHERE id = ?', [passwordHash, userId]);
    await connection.query('UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL', [userId]);
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
};
module.exports = { replacePassword };
