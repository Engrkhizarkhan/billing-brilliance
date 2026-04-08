const { pool } = require('../config/database');

const fetchPaymentHistory = async (req, res, next) => {
  try {
    let where = 'WHERE 1=1';
    const params = [];
    if (req.tenantId) { where += ' AND p.tenant_id = ?'; params.push(req.tenantId); }

    const [rows] = await pool.query(
      `SELECT p.*,
              s.name        AS student_name,
              s.class       AS class_name,
              s.roll_number AS roll_number,
              s.bill_id     AS bill_id,
              s.section     AS section
       FROM payments p
       LEFT JOIN students s ON p.student_id = s.id
       ${where} ORDER BY p.date DESC, p.created_at DESC`,
      params
    );

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

module.exports = { fetchPaymentHistory };
