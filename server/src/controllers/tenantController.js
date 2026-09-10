const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { auditLog } = require('../middleware/auditLog');
const { getCapacity } = require('../services/consumerNumberService');
const { generateApiKey, decryptApiKey } = require('../services/apiKeyService');
const { requireAdminPin } = require('../services/privilegedActionService');
const { provisionSandboxTenant, purgeSandboxTenant } = require('../services/sandboxLifecycleService');

const sanitizeTenant = (tenant, revealedSecret) => {
  if (!tenant) return tenant;
  const { api_key, api_key_hash, api_key_encrypted, ...safe } = tenant;
  void api_key; void api_key_hash; void api_key_encrypted;
  if (revealedSecret) safe.api_key = revealedSecret;
  return safe;
};

const fetchTenants = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 25, status, type, search } = req.query;
    const offset = (page - 1) * pageSize;

    let where = 'WHERE deleted_at IS NULL';
    const params = [];

    if (status) { where += ' AND status = ?'; params.push(status); }
    if (type) { where += ' AND type = ?'; params.push(type); }
    if (search) {
      where += ' AND (name LIKE ? OR biller_code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM tenants ${where}`, params);
    const [rows] = await pool.query(
      `SELECT id, name, type, biller_code, email, phone, status, lifecycle_stage,
              consumer_number_length, suspension_reason, suspended_at, restored_at,
              api_key_prefix, api_key_scope, api_key_rotated_at, created_at, updated_at
       FROM tenants ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );

    res.json({
      data: rows,
      meta: { page: parseInt(page), pageSize: parseInt(pageSize), total: countRows[0].total },
    });
  } catch (err) {
    next(err);
  }
};

const getTenant = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tenants WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (rows.length === 0) throw new AppError('Tenant not found', 404);
    res.json({ data: sanitizeTenant(rows[0]) });
  } catch (err) {
    next(err);
  }
};

const createTenant = async (req, res, next) => {
  try {
    const { name, type, email, phone, billerCode, consumerNumberLength = 24 } = req.body;
    if (!name?.trim() || !email?.trim()) throw new AppError('Name and email are required', 400, 'VALIDATION_ERROR');
    if (!['school', 'org', 'private_agency'].includes(type)) throw new AppError('Invalid biller type', 400, 'VALIDATION_ERROR');
    if (![14, 24].includes(Number(consumerNumberLength))) {
      throw new AppError('Consumer-number length must be 14 or 24 digits', 400, 'INVALID_CONSUMER_LENGTH');
    }

    // Auto-generate biller code if not provided
    let code = billerCode;
    if (!code) {
      const [maxRows] = await pool.query('SELECT MAX(CAST(biller_code AS UNSIGNED)) as max_code FROM tenants');
      const maxCode = maxRows[0].max_code || 1000;
      code = String(maxCode + 1);
    }
    if (!/^\d+$/.test(String(code))) throw new AppError('Biller code must contain digits only', 400, 'INVALID_BILLER_CODE');
    const capacity = getCapacity(Number(consumerNumberLength), code);
    if (capacity.maxSequence < 1) throw new AppError('Biller code is too long for the selected consumer-number length', 400, 'INVALID_BILLER_CODE');

    const id = uuidv4();
    const apiKey = generateApiKey();
    await pool.query(
      `INSERT INTO tenants
       (id, name, type, biller_code, email, phone, status, lifecycle_stage, consumer_number_length,
        api_key, api_key_hash, api_key_encrypted, api_key_prefix, api_key_scope, api_key_rotated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', 'testing', ?, NULL, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [id, name.trim(), type, code, email.trim(), phone || null, Number(consumerNumberLength),
        apiKey.hash, apiKey.encrypted, apiKey.prefix, apiKey.scope]
    );

    await auditLog(req, 'create', 'tenant', id, `Tenant ${name} created with code ${code}`);

    const [rows] = await pool.query('SELECT * FROM tenants WHERE id = ?', [id]);
    res.status(201).json({ data: sanitizeTenant(rows[0], apiKey.secret), message: 'Tenant created; copy the API key now because it will not be shown again' });
  } catch (err) {
    next(err);
  }
};

const updateTenant = async (req, res, next) => {
  try {
    const { name, type, email, phone } = req.body;
    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (type !== undefined) { updates.push('type = ?'); params.push(type); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }

    if (updates.length === 0) throw new AppError('No fields to update', 400);

    params.push(req.params.id);
    await pool.query(`UPDATE tenants SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`, params);

    await auditLog(req, 'update', 'tenant', req.params.id, `Tenant updated`);

    const [rows] = await pool.query('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
    if (rows.length === 0) throw new AppError('Tenant not found', 404);

    res.json({ data: sanitizeTenant(rows[0]), message: 'Tenant updated' });
  } catch (err) {
    next(err);
  }
};

const updateTenantStatus = async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    if (!['active', 'suspended', 'banned'].includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    const [rows] = await pool.query('SELECT * FROM tenants WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (rows.length === 0) throw new AppError('Tenant not found', 404);
    if (rows[0].status === status) return res.json({ data: rows[0], message: 'Status already set' });
    if (status !== 'active' && (!reason || reason.trim().length < 5)) {
      throw new AppError('A suspension reason of at least 5 characters is required', 400, 'REASON_REQUIRED');
    }

    if (status === 'active') {
      await pool.query(
        `UPDATE tenants SET status = 'active', suspension_reason = NULL,
         restored_at = UTC_TIMESTAMP() WHERE id = ?`, [req.params.id]
      );
    } else {
      await pool.query(
        `UPDATE tenants SET status = ?, suspension_reason = ?, suspended_at = UTC_TIMESTAMP(),
         suspended_by = ?, restored_at = NULL WHERE id = ?`,
        [status, reason.trim(), req.user.id, req.params.id]
      );
    }
    await auditLog(req, 'update', 'tenant', req.params.id, `Tenant status changed to ${status}${reason ? `: ${reason.trim()}` : ''}`);

    const [updated] = await pool.query('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
    res.json({ data: sanitizeTenant(updated[0]), message: status === 'active' ? 'Biller restored' : 'Biller suspended' });
  } catch (err) {
    next(err);
  }
};

const updateTenantLifecycle = async (req, res, next) => {
  try {
    const { lifecycleStage, checklist = {}, reason = '', confirmation = '' } = req.body;
    if (!['testing', 'ready_for_live', 'live', 'offboarding'].includes(lifecycleStage)) {
      throw new AppError('Invalid lifecycle stage', 400, 'INVALID_LIFECYCLE');
    }
    const [rows] = await pool.query('SELECT * FROM tenants WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (!rows.length) throw new AppError('Tenant not found', 404);
    if (lifecycleStage === 'live') {
      await requireAdminPin(req, 'tenant_lifecycle', req.params.id, 'activate biller');
      if (confirmation !== `ACTIVATE ${req.params.id}`) {
        throw new AppError('Explicit production activation confirmation is required', 400, 'CONFIRMATION_REQUIRED');
      }
      const required = ['profileComplete', 'credentialsIssued', 'ipAllowlistConfigured', 'uatPassed', 'supportContactsRecorded'];
      const missing = required.filter((key) => checklist[key] !== true);
      if (missing.length) throw new AppError(`Activation checklist incomplete: ${missing.join(', ')}`, 400, 'CHECKLIST_INCOMPLETE');
      await purgeSandboxTenant(req.params.id);
    }

    await pool.query(
      `UPDATE tenants SET lifecycle_stage = ?, activation_checklist = ?,
       activated_at = CASE WHEN ? = 'live' THEN UTC_TIMESTAMP() ELSE activated_at END,
       activated_by = CASE WHEN ? = 'live' THEN ? ELSE activated_by END
       WHERE id = ?`,
      [lifecycleStage, JSON.stringify(checklist), lifecycleStage, lifecycleStage, req.user.id, req.params.id]
    );
    await auditLog(req, 'update', 'tenant_lifecycle', req.params.id,
      `Lifecycle changed to ${lifecycleStage}${reason ? `: ${reason}` : ''}`);
    const [updated] = await pool.query('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
    res.json({ data: sanitizeTenant(updated[0]), message: `Biller lifecycle changed to ${lifecycleStage}` });
  } catch (err) {
    next(err);
  }
};

const provisionTenantSandbox = async (req, res, next) => {
  try {
    await requireAdminPin(req, 'tenant_sandbox', req.params.id, 'provision sandbox');
    if (req.body.confirmation !== `PROVISION ${req.params.id}`) {
      throw new AppError('Explicit sandbox provisioning confirmation is required', 400, 'CONFIRMATION_REQUIRED');
    }
    const [rows] = await pool.query(
      `SELECT id, name, type, biller_code, email, phone, lifecycle_stage, consumer_number_length
       FROM tenants WHERE id = ? AND deleted_at IS NULL LIMIT 1`, [req.params.id]
    );
    if (!rows.length) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
    if (rows[0].lifecycle_stage === 'live') throw new AppError('Live tenants cannot be provisioned in sandbox', 409, 'TENANT_ALREADY_LIVE');
    const tenant = rows[0];
    const result = await provisionSandboxTenant({
      id: tenant.id, name: tenant.name, type: tenant.type, billerCode: tenant.biller_code,
      email: tenant.email, phone: tenant.phone, consumerNumberLength: tenant.consumer_number_length,
    });
    if (!result) throw new AppError('Configure the isolated sandbox service before provisioning', 503, 'SANDBOX_NOT_CONFIGURED');
    await auditLog(req, 'create', 'tenant_sandbox', tenant.id, 'Sandbox tenant provisioned; key returned through one-time response');
    res.set('Cache-Control', 'no-store');
    res.json({ data: result, message: 'Sandbox provisioned; deliver this test key through a secure channel' });
  } catch (error) { next(error); }
};

const regenerateTenantApiKey = async (req, res, next) => {
  try {
    await requireAdminPin(req, 'tenant_api_key', req.params.id, 'regenerate API key');
    if (req.body.confirmation !== `REGENERATE ${req.params.id}`) {
      throw new AppError('Explicit API key regeneration confirmation is required', 400, 'CONFIRMATION_REQUIRED');
    }
    const [existing] = await pool.query('SELECT id FROM tenants WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (existing.length === 0) throw new AppError('Tenant not found', 404);

    const newApiKey = generateApiKey();
    await pool.query(
      `UPDATE tenants SET api_key = NULL, api_key_hash = ?, api_key_encrypted = ?, api_key_prefix = ?,
       api_key_scope = ?, api_key_rotated_at = UTC_TIMESTAMP() WHERE id = ?`,
      [newApiKey.hash, newApiKey.encrypted, newApiKey.prefix, newApiKey.scope, req.params.id]
    );
    await auditLog(req, 'update', 'tenant', req.params.id, 'API key regenerated');

    const [rows] = await pool.query('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
    res.set('Cache-Control', 'no-store');
    res.json({ data: sanitizeTenant(rows[0], newApiKey.secret), message: 'API key regenerated; copy it now because it will not be shown again' });
  } catch (err) {
    next(err);
  }
};

const revealTenantApiKey = async (req, res, next) => {
  try {
    await requireAdminPin(req, 'tenant_api_key', req.params.id, 'reveal API key');
    const [rows] = await pool.query(
      `SELECT id, api_key_encrypted, api_key_prefix FROM tenants
       WHERE id = ? AND deleted_at IS NULL LIMIT 1`, [req.params.id]
    );
    if (!rows.length) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
    if (!rows[0].api_key_encrypted) {
      throw new AppError('This legacy key cannot be recovered. Regenerate it to create a recoverable encrypted key.', 409, 'KEY_NOT_RECOVERABLE');
    }
    let secret;
    try { secret = decryptApiKey(rows[0].api_key_encrypted); }
    catch { throw new AppError('Stored API key could not be decrypted; rotate it before use', 409, 'KEY_DECRYPTION_FAILED'); }
    await auditLog(req, 'reveal', 'tenant_api_key', req.params.id, 'API key revealed after PIN verification');
    res.set('Cache-Control', 'no-store');
    res.json({ data: { apiKey: secret, apiKeyPrefix: rows[0].api_key_prefix } });
  } catch (err) {
    next(err);
  }
};

const offboardTenant = async (req, res, next) => {
  try {
    await requireAdminPin(req, 'tenant', req.params.id, 'offboard biller');
    const [rows] = await pool.query(
      'SELECT id, name, status FROM tenants WHERE id = ? AND deleted_at IS NULL', [req.params.id]
    );
    if (!rows.length) throw new AppError('Tenant not found', 404);
    const tenant = rows[0];
    if (tenant.status === 'active') {
      throw new AppError('Suspend the biller before offboarding it', 409, 'SUSPEND_FIRST');
    }
    if (req.body.confirmation !== tenant.name) {
      throw new AppError('Type the exact biller name to confirm offboarding', 400, 'CONFIRMATION_REQUIRED');
    }
    if (!req.body.reason || req.body.reason.trim().length < 5) {
      throw new AppError('An offboarding reason of at least 5 characters is required', 400, 'REASON_REQUIRED');
    }
    await pool.query(
      `UPDATE tenants SET status = 'banned', lifecycle_stage = 'offboarding',
       api_key = NULL, api_key_hash = NULL, api_key_encrypted = NULL, deleted_at = UTC_TIMESTAMP()
       WHERE id = ? AND status != 'active'`,
      [tenant.id]
    );
    await pool.query(
      `UPDATE users SET status = 'suspended' WHERE tenant_id = ? AND deleted_at IS NULL`, [tenant.id]
    );
    await auditLog(req, 'delete', 'tenant', tenant.id,
      `Biller offboarded; financial history retained. Reason: ${req.body.reason.trim()}`);
    res.json({ data: true, message: 'Biller offboarded; financial records were retained' });
  } catch (err) {
    next(err);
  }
};

module.exports = { fetchTenants, getTenant, createTenant, updateTenant, updateTenantStatus, updateTenantLifecycle, provisionTenantSandbox, regenerateTenantApiKey, revealTenantApiKey, offboardTenant };
