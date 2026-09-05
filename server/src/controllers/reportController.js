const { pool } = require('../config/database');

// ---- Dashboard stats ----
const getDashboardStats = async (req, res, next) => {
  try {
    const tenantClause = req.tenantId ? 'tenant_id = ?' : '1=1';
    const aliasedTenantClause = (alias) => req.tenantId ? `${alias}.tenant_id = ?` : '1=1';
    const params = () => req.tenantId ? [req.tenantId] : [];

    const [
      [studentRows], [invoiceRows], [txnRows], [lateFeeRows],
      [classRows], [defaulterClassRows], [paymentRows],
    ] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS total_students,
                SUM(CASE WHEN NOT EXISTS (
                  SELECT 1 FROM invoices i
                  WHERE i.student_id = s.id AND i.month = DATE_FORMAT(CURDATE(), '%Y-%m')
                    AND i.deleted_at IS NULL
                ) THEN 1 ELSE 0 END) AS students_without_current_bill
         FROM students s
         WHERE ${aliasedTenantClause('s')} AND s.deleted_at IS NULL`,
        params()
      ),
      pool.query(
        `SELECT COUNT(*) AS total_invoices,
                SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid_invoices,
                SUM(CASE WHEN status != 'paid' AND due_date >= CURDATE() THEN 1 ELSE 0 END) AS pending_invoices,
                SUM(CASE WHEN status != 'paid' AND due_date < CURDATE() THEN 1 ELSE 0 END) AS overdue_invoices,
                COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paid_revenue,
                COALESCE(SUM(CASE WHEN status != 'paid' THEN amount ELSE 0 END), 0) AS pending_amount,
                COALESCE(SUM(CASE WHEN status != 'paid' AND due_date < CURDATE() THEN amount ELSE 0 END), 0) AS overdue_amount,
                COUNT(DISTINCT CASE WHEN status != 'paid' THEN student_id END) AS defaulters_count
         FROM invoices WHERE ${tenantClause} AND deleted_at IS NULL`,
        params()
      ),
      pool.query(`SELECT COUNT(*) AS total_transactions FROM transactions WHERE ${tenantClause}`, params()),
      pool.query(
        `SELECT COALESCE(SUM(debit), 0) AS total_late_fees
         FROM ledger_entries WHERE ${tenantClause} AND entry_type = 'late_fee'`,
        params()
      ),
      pool.query(
        `SELECT s.class AS name, COUNT(*) AS count
         FROM students s WHERE ${aliasedTenantClause('s')} AND s.deleted_at IS NULL
         GROUP BY s.class ORDER BY s.class`,
        params()
      ),
      pool.query(
        `SELECT s.class AS class_name, COUNT(DISTINCT s.id) AS count
         FROM students s
         JOIN invoices i ON i.student_id = s.id AND i.status != 'paid' AND i.deleted_at IS NULL
         WHERE ${aliasedTenantClause('s')} AND s.deleted_at IS NULL
         GROUP BY s.class ORDER BY s.class`,
        params()
      ),
      pool.query(
        `WITH scoped_payments AS (
           SELECT amount, date FROM payments WHERE ${tenantClause}
         ), latest AS (SELECT DATE(MAX(date)) AS payment_date FROM scoped_payments)
         SELECT COALESCE(SUM(CASE WHEN DATE_FORMAT(sp.date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') THEN sp.amount ELSE 0 END), 0) AS collected_this_month,
                latest.payment_date AS latest_payment_date,
                COALESCE(SUM(CASE WHEN DATE(sp.date) = latest.payment_date THEN 1 ELSE 0 END), 0) AS latest_day_payments,
                COALESCE(SUM(CASE WHEN DATE(sp.date) = latest.payment_date THEN sp.amount ELSE 0 END), 0) AS latest_day_amount
         FROM scoped_payments sp CROSS JOIN latest`,
        params()
      ),
    ]);

    const students = studentRows[0] || {};
    const invoices = invoiceRows[0] || {};
    const payments = paymentRows[0] || {};

    res.json({
      data: {
        totalStudents: Number(students.total_students || 0),
        studentsWithoutCurrentBill: Number(students.students_without_current_bill || 0),
        totalInvoices: Number(invoices.total_invoices || 0),
        paidInvoices: Number(invoices.paid_invoices || 0),
        pendingInvoices: Number(invoices.pending_invoices || 0),
        overdueInvoices: Number(invoices.overdue_invoices || 0),
        paidRevenue: Number(invoices.paid_revenue || 0),
        pendingAmount: Number(invoices.pending_amount || 0),
        overdueAmount: Number(invoices.overdue_amount || 0),
        defaultersCount: Number(invoices.defaulters_count || 0),
        totalTransactions: Number(txnRows[0]?.total_transactions || 0),
        totalLateFees: Number(lateFeeRows[0]?.total_late_fees || 0),
        collectedThisMonth: Number(payments.collected_this_month || 0),
        latestPaymentDate: payments.latest_payment_date || null,
        latestDayPayments: Number(payments.latest_day_payments || 0),
        latestDayAmount: Number(payments.latest_day_amount || 0),
        classSummary: classRows.map((row) => ({ name: row.name, count: Number(row.count) })),
        defaultersByClass: defaulterClassRows.map((row) => ({ className: row.class_name, count: Number(row.count) })),
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

    // Attribute settled invoice value directly to its fee plan. Joining payments
    // through student assignments over-counts students with more than one plan.
    const [rows] = await pool.query(
      `SELECT fp.name,
              COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.amount ELSE 0 END), 0) AS value
       FROM fee_plans fp
       LEFT JOIN invoices i ON i.fee_plan_id = fp.id AND i.tenant_id = ? AND i.deleted_at IS NULL
       WHERE fp.tenant_id = ? AND fp.deleted_at IS NULL
       GROUP BY fp.id, fp.name, fp.amount
       ORDER BY value DESC`,
      [tenantId, tenantId]
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
