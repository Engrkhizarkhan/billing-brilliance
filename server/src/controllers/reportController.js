const { pool } = require('../config/database');

// ---- Dashboard stats ----
const getDashboardStats = async (req, res, next) => {
  try {
    const tenantWhere = req.tenantId ? 'WHERE tenant_id = ?' : 'WHERE 1=1';
    const params = req.tenantId ? [req.tenantId] : [];

    const [[studentCount]] = await pool.query(`SELECT COUNT(*) as count FROM students ${tenantWhere} AND deleted_at IS NULL`, params);
    const [[invoiceCount]] = await pool.query(`SELECT COUNT(*) as count FROM invoices ${tenantWhere} AND deleted_at IS NULL`, params);
    const [[paidRevenue]] = await pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM invoices ${tenantWhere} AND status = 'paid' AND deleted_at IS NULL`, params);
    const [[pendingAmount]] = await pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM invoices ${tenantWhere} AND status != 'paid' AND deleted_at IS NULL`, params);
    const [[overdueCount]] = await pool.query(`SELECT COUNT(*) as count FROM invoices ${tenantWhere} AND status = 'overdue' AND deleted_at IS NULL`, params);
    const [[txnCount]] = await pool.query(`SELECT COUNT(*) as count FROM transactions ${tenantWhere}`, params);
    const [[lateFeeRow]] = await pool.query(
      `SELECT COALESCE(SUM(debit), 0) as total FROM ledger_entries ${tenantWhere} AND entry_type = 'late_fee'`,
      params
    );

    res.json({
      data: {
        totalStudents: studentCount.count,
        totalInvoices: invoiceCount.count,
        paidRevenue: parseFloat(paidRevenue.total),
        pendingAmount: parseFloat(pendingAmount.total),
        overdueInvoices: overdueCount.count,
        totalTransactions: txnCount.count,
        totalLateFees: parseFloat(lateFeeRow.total),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ---- Collection trend (monthly) ----
const getCollectionTrend = async (req, res, next) => {
  try {
    const tenantWhere = req.tenantId ? 'AND tenant_id = ?' : '';
    const params = req.tenantId ? [req.tenantId] : [];

    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(date, '%Y-%m') as month, SUM(amount) as total
       FROM payments WHERE 1=1 ${tenantWhere}
       GROUP BY month ORDER BY month DESC LIMIT 12`,
      params
    );

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

// ---- Admin platform summary ----
const getPlatformSummary = async (req, res, next) => {
  try {
    const [[tenantCount]] = await pool.query('SELECT COUNT(*) as count FROM tenants WHERE deleted_at IS NULL');
    const [[userCount]] = await pool.query('SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL');
    const [[studentCount]] = await pool.query('SELECT COUNT(*) as count FROM students WHERE deleted_at IS NULL');
    const [[applicantCount]] = await pool.query('SELECT COUNT(*) as count FROM applicants WHERE deleted_at IS NULL');
    const [[revenue]] = await pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = 'paid' AND deleted_at IS NULL");

    res.json({
      data: {
        totalTenants: tenantCount.count,
        totalUsers: userCount.count,
        totalStudents: studentCount.count,
        totalApplicants: applicantCount.count,
        totalRevenue: parseFloat(revenue.total),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ---- Collection by fee plan (pie chart) ----
const getCollectionByFeePlan = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant required' });

    // Sum actual collected payments per fee plan via student assignments.
    // Falls back to the plan's configured amount when no payments exist yet.
    const [rows] = await pool.query(
      `SELECT fp.name,
              COALESCE(SUM(p.amount), fp.amount) AS value
       FROM fee_plans fp
       LEFT JOIN payment_plan_assignments ppa
             ON ppa.fee_plan_id = fp.id AND ppa.tenant_id = ?
       LEFT JOIN payments p
             ON p.student_id = ppa.student_id AND p.tenant_id = ?
       WHERE fp.tenant_id = ? AND fp.deleted_at IS NULL
       GROUP BY fp.id, fp.name, fp.amount
       ORDER BY value DESC`,
      [tenantId, tenantId, tenantId]
    );

    res.json({ data: rows.map((r) => ({ name: r.name, value: parseFloat(r.value) })) });
  } catch (err) {
    next(err);
  }
};

// ---- Monthly collection trend (real payments table) ----
const getMonthlyTrend = async (req, res, next) => {
  try {
    const tenantWhere = req.tenantId ? 'AND tenant_id = ?' : '';
    const params = req.tenantId ? [req.tenantId] : [];

    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(date, '%b') AS month,
              DATE_FORMAT(date, '%Y-%m') AS sort_key,
              COALESCE(SUM(amount), 0) AS collected
       FROM payments
       WHERE date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH) ${tenantWhere}
       GROUP BY sort_key, month
       ORDER BY sort_key ASC`,
      params
    );

    res.json({ data: rows.map((r) => ({ month: r.month, collected: parseFloat(r.collected) })) });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboardStats, getCollectionTrend, getPlatformSummary, getCollectionByFeePlan, getMonthlyTrend };
