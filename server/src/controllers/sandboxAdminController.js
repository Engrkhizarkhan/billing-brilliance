const config = require('../config');
const crypto = require('crypto');
const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { generateApiKey, decryptApiKey } = require('../services/apiKeyService');

const authorizeInternal = (req) => {
  if (config.appEnvironment !== 'sandbox') throw new AppError('Sandbox administration is unavailable', 404, 'NOT_FOUND');
  const expected = String(config.sandbox.purgeSecret || '');
  const provided = String(req.headers['x-sandbox-admin-secret'] || '');
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (!expected || expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
    throw new AppError('Invalid sandbox administration credential', 401, 'INVALID_SANDBOX_CREDENTIAL');
  }
};

const provision = async (req, res, next) => {
  try {
    authorizeInternal(req);
    const tenant = req.body || {};
    if (!tenant.id || !tenant.name || !tenant.type || !tenant.billerCode || !tenant.email) {
      throw new AppError('Complete tenant details are required', 400, 'VALIDATION_ERROR');
    }
    const [existing] = await pool.query('SELECT api_key_encrypted FROM tenants WHERE id = ? AND deleted_at IS NULL', [tenant.id]);
    if (existing.length) {
      if (!existing[0].api_key_encrypted) throw new AppError('Existing sandbox key must be rotated', 409, 'KEY_NOT_RECOVERABLE');
      return res.json({ data: { tenantId: tenant.id, apiKey: decryptApiKey(existing[0].api_key_encrypted), alreadyProvisioned: true } });
    }
    const key = generateApiKey();
    await pool.query(
      `INSERT INTO tenants
       (id, name, type, biller_code, email, phone, status, lifecycle_stage, consumer_number_length,
        api_key_hash, api_key_encrypted, api_key_prefix, api_key_scope, api_key_rotated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', 'testing', ?, ?, ?, ?, 'test', UTC_TIMESTAMP())`,
      [tenant.id, tenant.name, tenant.type, tenant.billerCode, tenant.email, tenant.phone || null,
        Number(tenant.consumerNumberLength) || 24, key.hash, key.encrypted, key.prefix]
    );
    res.set('Cache-Control', 'no-store');
    res.status(201).json({ data: { tenantId: tenant.id, apiKey: key.secret, alreadyProvisioned: false } });
  } catch (error) { next(error); }
};

const purge = async (req, res, next) => {
  let connection;
  try {
    authorizeInternal(req);
    const tenantId = req.params.id;
    connection = await pool.getConnection();
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.beginTransaction();
    const [tables] = await connection.query(
      `SELECT DISTINCT TABLE_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND COLUMN_NAME = 'tenant_id' AND TABLE_NAME <> 'tenants'`,
      [config.db.database]
    );
    for (const row of tables) {
      const table = String(row.TABLE_NAME).replace(/`/g, '');
      await connection.query(`DELETE FROM \`${table}\` WHERE tenant_id = ?`, [tenantId]);
    }
    await connection.query('DELETE FROM tenants WHERE id = ?', [tenantId]);
    await connection.commit();
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    res.json({ data: { tenantId, purged: true } });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
      await connection.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
    }
    next(error);
  } finally { connection?.release(); }
};

module.exports = { provision, purge };
