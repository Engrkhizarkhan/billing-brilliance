const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { auditLog } = require('../middleware/auditLog');

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
      `SELECT * FROM tenants ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
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
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
};

const createTenant = async (req, res, next) => {
  try {
    const { name, type, email, phone, billerCode } = req.body;

    // Auto-generate biller code if not provided
    let code = billerCode;
    if (!code) {
      const [maxRows] = await pool.query('SELECT MAX(CAST(biller_code AS UNSIGNED)) as max_code FROM tenants');
      const maxCode = maxRows[0].max_code || 1000;
      code = String(maxCode + 1);
    }

    const id = uuidv4();
    const apiKey = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, ''); // 64-char hex key
    await pool.query(
      'INSERT INTO tenants (id, name, type, biller_code, email, phone, status, api_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, type, code, email, phone || null, 'active', apiKey]
    );

    await auditLog(req, 'create', 'tenant', id, `Tenant ${name} created with code ${code}`);

    const [rows] = await pool.query('SELECT * FROM tenants WHERE id = ?', [id]);
    res.status(201).json({ data: rows[0], message: 'Tenant created' });
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

    res.json({ data: rows[0], message: 'Tenant updated' });
  } catch (err) {
    next(err);
  }
};

const updateTenantStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended', 'banned'].includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    const [rows] = await pool.query('SELECT * FROM tenants WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (rows.length === 0) throw new AppError('Tenant not found', 404);

    await pool.query('UPDATE tenants SET status = ? WHERE id = ?', [status, req.params.id]);
    await auditLog(req, 'update', 'tenant', req.params.id, `Tenant status changed to ${status}`);

    res.json({ data: { ...rows[0], status }, message: 'Status updated' });
  } catch (err) {
    next(err);
  }
};

const regenerateTenantApiKey = async (req, res, next) => {
  try {
    const [existing] = await pool.query('SELECT id FROM tenants WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (existing.length === 0) throw new AppError('Tenant not found', 404);

    const newApiKey = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
    await pool.query('UPDATE tenants SET api_key = ? WHERE id = ?', [newApiKey, req.params.id]);
    await auditLog(req, 'update', 'tenant', req.params.id, 'API key regenerated');

    const [rows] = await pool.query('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
    res.json({ data: rows[0], message: 'API key regenerated' });
  } catch (err) {
    next(err);
  }
};

module.exports = { fetchTenants, getTenant, createTenant, updateTenant, updateTenantStatus, regenerateTenantApiKey };
