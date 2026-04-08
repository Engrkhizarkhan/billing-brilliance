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

    res.json({
      data: {
        totalStudents: studentCount.count,
        totalInvoices: invoiceCount.count,
        paidRevenue: parseFloat(paidRevenue.total),
        pendingAmount: parseFloat(pendingAmount.total),
        overdueInvoices: overdueCount.count,
        totalTransactions: txnCount.count,
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

module.exports = { getDashboardStats, getCollectionTrend, getPlatformSummary };
