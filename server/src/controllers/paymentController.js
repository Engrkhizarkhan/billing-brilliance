const { pool } = require('../config/database');

const fetchPaymentHistory = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 25, search, className, channel, month } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    let where = 'WHERE 1=1';
    const params = [];

    if (req.tenantId) { where += ' AND p.tenant_id = ?'; params.push(req.tenantId); }
    if (channel) { where += ' AND p.channel = ?'; params.push(channel); }
    if (month) { where += ' AND DATE_FORMAT(p.date, \'%Y-%m\') = ?'; params.push(month); }
    if (className) { where += ' AND s.class = ?'; params.push(className); }
    if (search) {
      where += ' AND (s.name LIKE ? OR p.consumer_number LIKE ? OR p.reference LIKE ? OR p.receipt_number LIKE ? OR s.roll_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM payments p LEFT JOIN students s ON p.student_id = s.id ${where}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT p.*,
              s.name        AS student_name,
              s.class       AS class_name,
              s.roll_number AS roll_number,
              s.bill_id     AS bill_id,
              s.section     AS section
       FROM payments p
       LEFT JOIN students s ON p.student_id = s.id
       ${where} ORDER BY p.date DESC, p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );

    // Summary stats (scoped to tenant, unfiltered by search/month/channel for totals)
    const statsParams = req.tenantId ? [req.tenantId] : [];
    const statsWhere = req.tenantId ? 'WHERE tenant_id = ?' : '';
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [statsRows] = await pool.query(
      `SELECT
         COALESCE(SUM(amount), 0)                                                         AS total_collected,
         COALESCE(SUM(CASE WHEN DATE_FORMAT(date,'%Y-%m') = ? THEN amount ELSE 0 END), 0) AS this_month,
         COUNT(*)                                                                          AS total_count,
         COUNT(DISTINCT student_id)                                                        AS unique_students
       FROM payments ${statsWhere}`,
      [currentMonth, ...statsParams]
    );

    res.json({
      data: rows,
      meta: { page: parseInt(page), pageSize: parseInt(pageSize), total: countRows[0].total },
      stats: statsRows[0],
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { fetchPaymentHistory };
