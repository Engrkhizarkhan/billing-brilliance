const { pool } = require('../config/database');

const fetchAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 25, action, entity, userId, search } = req.query;
    const offset = (page - 1) * pageSize;

    let where = 'WHERE 1=1';
    const params = [];

    if (req.tenantId && req.user.role !== 'admin') {
      where += ' AND a.tenant_id = ?';
      params.push(req.tenantId);
    }
    if (action) { where += ' AND a.action = ?'; params.push(action); }
    if (entity) { where += ' AND a.entity = ?'; params.push(entity); }
    if (userId) { where += ' AND a.user_id = ?'; params.push(userId); }
    if (search) {
      where += ' AND (a.details LIKE ? OR a.user_name LIKE ? OR a.entity_id LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ${where}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT a.*, u.email as user_email, u.role as user_role, u.school_access_role
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ${where}
       ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
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

module.exports = { fetchAuditLogs };
