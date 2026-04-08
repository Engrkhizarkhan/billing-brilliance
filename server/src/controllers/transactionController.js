const { pool } = require('../config/database');

const fetchTransactions = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 25, status, search } = req.query;
    const offset = (page - 1) * pageSize;

    let where = 'WHERE 1=1';
    const params = [];

    if (req.tenantId) { where += ' AND tenant_id = ?'; params.push(req.tenantId); }
    if (status) { where += ' AND status = ?'; params.push(status); }
    if (search) {
      where += ' AND (transaction_id LIKE ? OR consumer_number LIKE ? OR biller_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM transactions ${where}`, params);
    const [rows] = await pool.query(
      `SELECT * FROM transactions ${where} ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`,
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

const getTransaction = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = { fetchTransactions, getTransaction };
