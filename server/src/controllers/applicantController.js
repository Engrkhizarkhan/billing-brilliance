const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { auditLog } = require('../middleware/auditLog');

const fetchApplicants = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 25, status, postingId, search } = req.query;
    const offset = (page - 1) * pageSize;

    let where = 'WHERE a.deleted_at IS NULL';
    const params = [];

    if (req.tenantId) { where += ' AND a.tenant_id = ?'; params.push(req.tenantId); }
    if (status) { where += ' AND a.application_status = ?'; params.push(status); }
    if (postingId) { where += ' AND a.service_id = ?'; params.push(postingId); }
    if (search) {
      where += ' AND (a.name LIKE ? OR a.cnic LIKE ? OR a.roll_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM applicants a ${where}`, params);
    const [rows] = await pool.query(
      `SELECT * FROM applicants a ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
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

const getApplicant = async (req, res, next) => {
  try {
    let where = 'WHERE id = ? AND deleted_at IS NULL';
    const params = [req.params.id];
    if (req.tenantId) { where += ' AND tenant_id = ?'; params.push(req.tenantId); }

    const [rows] = await pool.query(`SELECT * FROM applicants ${where}`, params);
    if (rows.length === 0) throw new AppError('Applicant not found', 404);

    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
};

const createApplicant = (_req, res) => res.status(410).json({
  error: 'Applicant-only consumer creation is retired. Create a collectible payment request using /api/payments/create.',
  code: 'APPLICANT_CREATION_RETIRED',
});

const assignRoll = async (req, res, next) => {
  try {
    const { rollNumber, center } = req.body;

    let where = 'WHERE id = ? AND deleted_at IS NULL';
    const params = [req.params.id];
    if (req.tenantId) { where += ' AND tenant_id = ?'; params.push(req.tenantId); }

    const [existing] = await pool.query(`SELECT * FROM applicants ${where}`, params);
    if (existing.length === 0) throw new AppError('Applicant not found', 404);

    const applicant = existing[0];
    const assignedRoll = rollNumber || applicant.roll_number || `MDCAT-${String(300000 + parseInt(applicant.id.replace(/\D/g, '') || 1)).padStart(6, '0')}`;
    const testCenter = center || applicant.test_center || 'Peshawar Test Center';

    await pool.query(
      'UPDATE applicants SET roll_number = ?, test_center = ?, application_status = ? WHERE id = ?',
      [assignedRoll, testCenter, 'roll_assigned', req.params.id]
    );

    await auditLog(req, 'update', 'applicant', req.params.id, `Roll ${assignedRoll} assigned`);

    const [rows] = await pool.query('SELECT * FROM applicants WHERE id = ?', [req.params.id]);
    res.json({ data: rows[0], message: 'Roll assigned' });
  } catch (err) {
    next(err);
  }
};

const recordResult = async (req, res, next) => {
  try {
    const { marks, status = 'result_pending' } = req.body;

    let where = 'WHERE id = ? AND deleted_at IS NULL';
    const params = [req.params.id];
    if (req.tenantId) { where += ' AND tenant_id = ?'; params.push(req.tenantId); }

    const [existing] = await pool.query(`SELECT id FROM applicants ${where}`, params);
    if (existing.length === 0) throw new AppError('Applicant not found', 404);

    await pool.query(
      'UPDATE applicants SET marks = ?, application_status = ? WHERE id = ?',
      [marks, status, req.params.id]
    );

    await auditLog(req, 'update', 'applicant', req.params.id, `Result recorded: ${marks} marks`);

    const [rows] = await pool.query('SELECT * FROM applicants WHERE id = ?', [req.params.id]);
    res.json({ data: rows[0], message: 'Result recorded' });
  } catch (err) {
    next(err);
  }
};

module.exports = { fetchApplicants, getApplicant, createApplicant, assignRoll, recordResult };
