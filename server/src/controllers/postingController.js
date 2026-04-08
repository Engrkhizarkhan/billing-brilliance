const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { auditLog } = require('../middleware/auditLog');
const { createRequestNotification } = require('../services/notificationService');

// ---- ETEA Postings ----
const fetchPostings = async (req, res, next) => {
  try {
    let where = 'WHERE deleted_at IS NULL';
    const params = [];
    if (req.tenantId) { where += ' AND tenant_id = ?'; params.push(req.tenantId); }

    const [rows] = await pool.query(`SELECT * FROM etea_postings ${where} ORDER BY created_at DESC`, params);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const getPosting = async (req, res, next) => {
  try {
    let where = 'WHERE id = ? AND deleted_at IS NULL';
    const params = [req.params.id];
    if (req.tenantId) { where += ' AND tenant_id = ?'; params.push(req.tenantId); }

    const [rows] = await pool.query(`SELECT * FROM etea_postings ${where}`, params);
    if (rows.length === 0) throw new AppError('Posting not found', 404);

    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
};

const createPosting = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.body.tenantId;
    if (!tenantId) throw new AppError('Tenant ID is required', 400);

    const { title, type, department, totalSeats, applicationFee, startDate, endDate, testDate } = req.body;

    const id = uuidv4();
    await pool.query(
      `INSERT INTO etea_postings (id, tenant_id, title, type, department, total_seats, application_fee, start_date, end_date, test_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [id, tenantId, title, type, department || null, totalSeats || 0, applicationFee || 0, startDate, endDate, testDate || null]
    );

    await auditLog(req, 'create', 'posting', id, `Posting ${title} created`);
    await createRequestNotification(req, {
      title: 'Posting created',
      message: `${title} was created in draft mode.`,
      type: 'system',
      tenantId,
    });

    const [rows] = await pool.query('SELECT * FROM etea_postings WHERE id = ?', [id]);
    res.status(201).json({ data: rows[0], message: 'Posting created' });
  } catch (err) {
    next(err);
  }
};

const updatePosting = async (req, res, next) => {
  try {
    const { title, type, department, totalSeats, applicationFee, startDate, endDate, testDate, status } = req.body;

    let where = 'WHERE id = ? AND deleted_at IS NULL';
    const params = [req.params.id];
    if (req.tenantId) {
      where += ' AND tenant_id = ?';
      params.push(req.tenantId);
    }

    const [existing] = await pool.query(`SELECT * FROM etea_postings ${where}`, params);
    if (existing.length === 0) throw new AppError('Posting not found', 404);

    const mapping = {
      title: 'title',
      type: 'type',
      department: 'department',
      totalSeats: 'total_seats',
      applicationFee: 'application_fee',
      startDate: 'start_date',
      endDate: 'end_date',
      testDate: 'test_date',
      status: 'status',
    };

    const updates = [];
    const values = [];
    for (const [key, column] of Object.entries(mapping)) {
      if (req.body[key] !== undefined) {
        updates.push(`${column} = ?`);
        values.push(req.body[key]);
      }
    }

    if (updates.length === 0) throw new AppError('No fields to update', 400);

    values.push(req.params.id);
    await pool.query(`UPDATE etea_postings SET ${updates.join(', ')} WHERE id = ?`, values);
    await auditLog(req, 'update', 'posting', req.params.id, `Posting ${existing[0].title} updated`);
    await createRequestNotification(req, {
      title: 'Posting updated',
      message: `${title || existing[0].title} was updated.`,
      type: 'system',
    });

    const [rows] = await pool.query('SELECT * FROM etea_postings WHERE id = ?', [req.params.id]);
    res.json({ data: rows[0], message: 'Posting updated' });
  } catch (err) {
    next(err);
  }
};

const updatePostingStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['draft', 'active', 'closed'].includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    let where = 'WHERE id = ? AND deleted_at IS NULL';
    const params = [req.params.id];
    if (req.tenantId) { where += ' AND tenant_id = ?'; params.push(req.tenantId); }

    const [existing] = await pool.query(`SELECT id, title FROM etea_postings ${where}`, params);
    if (existing.length === 0) throw new AppError('Posting not found', 404);

    await pool.query('UPDATE etea_postings SET status = ? WHERE id = ?', [status, req.params.id]);
    await auditLog(req, 'update', 'posting', req.params.id, `Posting status → ${status}`);
    await createRequestNotification(req, {
      title: 'Posting status updated',
      message: `${existing[0].title} is now ${status}.`,
      type: 'system',
    });

    const [rows] = await pool.query('SELECT * FROM etea_postings WHERE id = ?', [req.params.id]);
    res.json({ data: rows[0], message: 'Posting updated' });
  } catch (err) {
    next(err);
  }
};

// ---- Services ----
const fetchServices = async (req, res, next) => {
  try {
    let where = 'WHERE deleted_at IS NULL';
    const params = [];
    if (req.tenantId) { where += ' AND tenant_id = ?'; params.push(req.tenantId); }

    const [rows] = await pool.query(`SELECT * FROM services ${where} ORDER BY name`, params);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const createService = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.body.tenantId;
    if (!tenantId) throw new AppError('Tenant ID is required', 400);

    const { name, paymentType, amount } = req.body;
    const id = uuidv4();

    await pool.query(
      'INSERT INTO services (id, tenant_id, name, payment_type, amount, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, tenantId, name, paymentType || 'one-time', amount, 'active']
    );

    await auditLog(req, 'create', 'service', id, `Service ${name} created`);

    const [rows] = await pool.query('SELECT * FROM services WHERE id = ?', [id]);
    res.status(201).json({ data: rows[0], message: 'Service created' });
  } catch (err) {
    next(err);
  }
};

module.exports = { fetchPostings, getPosting, createPosting, updatePosting, updatePostingStatus, fetchServices, createService };
