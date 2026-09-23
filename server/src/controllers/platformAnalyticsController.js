const { pool } = require('../config/database');

// Financial totals use signed payment entries, including original entries that
// have subsequently been reversed. The negative reversal offsets the original.
const getPlatformAnalytics = async (req, res, next) => {
  const page = Math.max(1, Math.min(1000000, Number.parseInt(req.query.page, 10) || 1));
  const pageSize = Math.max(1, Math.min(100, Number.parseInt(req.query.pageSize, 10) || 25));
  const connection = await pool.getConnection();
  try {
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    const [[counts]] = await connection.query(`SELECT
      (SELECT COUNT(*) FROM tenants WHERE deleted_at IS NULL) AS tenants,
      (SELECT COUNT(*) FROM tenants WHERE deleted_at IS NULL AND status = 'active') AS activeTenants,
      (SELECT COUNT(*) FROM students WHERE deleted_at IS NULL) AS students,
      (SELECT COUNT(*) FROM invoices WHERE deleted_at IS NULL) AS invoices,
      (SELECT COUNT(*) FROM transactions) AS totalTransactions,
      (SELECT COUNT(*) FROM payments WHERE status = 'posted' AND reversal_of_payment_id IS NULL) AS totalPayments`);
    const [[funds]] = await connection.query(`SELECT COALESCE(SUM(amount),0) AS totalRevenue,
      COALESCE(SUM(CASE WHEN DATE(date) = UTC_DATE() THEN amount ELSE 0 END),0) AS revenueToday,
      COALESCE(SUM(CASE WHEN date >= DATE_FORMAT(UTC_DATE(), '%Y-%m-01') THEN amount ELSE 0 END),0) AS revenueThisMonth
      FROM payments WHERE status IN ('posted','reversed')`);
    const [[due]] = await connection.query(`SELECT COALESCE(SUM(amount),0) AS pendingAmount,
      COALESCE(SUM(CASE WHEN due_date < UTC_DATE() THEN amount ELSE 0 END),0) AS overdueAmount
      FROM (SELECT amount, due_date FROM invoices WHERE deleted_at IS NULL AND status != 'paid'
        UNION ALL SELECT amount, due_date FROM org_payment_records WHERE status = 'pending' AND expiry_date > UTC_TIMESTAMP()) outstanding`);
    const [months] = await connection.query(`SELECT DATE_FORMAT(date,'%Y-%m') AS month, SUM(amount) AS revenue
      FROM payments WHERE status IN ('posted','reversed') AND date >= DATE_SUB(DATE_FORMAT(UTC_DATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
      GROUP BY month ORDER BY month`);
    const [volumes] = await connection.query(`SELECT DATE_FORMAT(date,'%Y-%m') AS month, COUNT(*) AS volume,
      SUM(status = 'completed') AS success, SUM(status = 'failed') AS failed
      FROM transactions WHERE date >= DATE_SUB(DATE_FORMAT(UTC_DATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
      GROUP BY month ORDER BY month`);
    const [days] = await connection.query(`SELECT DATE_FORMAT(date,'%Y-%m-%d') AS day,
      SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS inflow,
      SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS outflow
      FROM payments WHERE status IN ('posted','reversed') AND date >= DATE_SUB(UTC_DATE(), INTERVAL 6 DAY)
      GROUP BY day ORDER BY day`);
    const [types] = await connection.query(`SELECT t.type, SUM(p.amount) AS value FROM payments p
      JOIN tenants t ON t.id = p.tenant_id WHERE p.status IN ('posted','reversed') GROUP BY t.type`);
    const [tenants] = await connection.query(`SELECT t.id, t.name, t.type, t.biller_code AS billerCode, t.status,
      (SELECT COUNT(*) FROM students s WHERE s.tenant_id = t.id AND s.deleted_at IS NULL) AS studentCount,
      (SELECT COUNT(*) FROM invoices i WHERE i.tenant_id = t.id AND i.deleted_at IS NULL) AS invoiceCount,
      (SELECT COUNT(*) FROM transactions x WHERE x.tenant_id = t.id) AS txnCount,
      (SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.tenant_id = t.id AND p.status IN ('posted','reversed')) AS revenue,
      ((SELECT COALESCE(SUM(i.amount),0) FROM invoices i WHERE i.tenant_id = t.id AND i.deleted_at IS NULL AND i.status != 'paid') +
       (SELECT COALESCE(SUM(o.amount),0) FROM org_payment_records o WHERE o.tenant_id = t.id AND o.status = 'pending' AND o.expiry_date > UTC_TIMESTAMP())) AS pendingAmount
      FROM tenants t WHERE t.deleted_at IS NULL ORDER BY t.name, t.id LIMIT ? OFFSET ?`, [pageSize, (page - 1) * pageSize]);
    await connection.commit();
    const numeric = row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
    const now = new Date();
    const revenueData = Array.from({ length: 6 }, (_, index) => {
      const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1)).toISOString().slice(0, 7);
      return { month, revenue: Number(months.find(row => row.month === month)?.revenue || 0) };
    });
    res.json({ data: {
      totals: { ...numeric(counts), ...numeric(funds), ...numeric(due) },
      revenueData,
      paymentSuccessData: revenueData.map(({ month }) => ({ month, success: Number(volumes.find(r => r.month === month)?.success || 0), failed: Number(volumes.find(r => r.month === month)?.failed || 0) })),
      transactionVolumeData: revenueData.map(({ month }) => ({ month, volume: Number(volumes.find(r => r.month === month)?.volume || 0) })),
      dailyData: Array.from({ length: 7 }, (_, index) => {
        const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6 + index)).toISOString().slice(0, 10);
        const row = days.find(item => item.day === day);
        return { day, inflow: Number(row?.inflow || 0), outflow: Number(row?.outflow || 0) };
      }),
      pieData: types.map(row => ({ name: { school: 'Schools', org: 'Organizations', private_agency: 'Agencies' }[row.type] || row.type, value: Number(row.value) })),
      tenantSummary: tenants.map(({ studentCount, invoiceCount, txnCount, revenue, pendingAmount, ...tenant }) => ({ ...tenant, ...numeric({ studentCount, invoiceCount, txnCount, revenue, pendingAmount }) })),
    }, meta: { page, pageSize, total: Number(counts.tenants) } });
  } catch (error) { await connection.rollback(); next(error); }
  finally { connection.release(); }
};
module.exports = { getPlatformAnalytics };
