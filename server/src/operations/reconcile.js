const { pool } = require('../config/database');

// Read-only evidence report. This intentionally never repairs historical money.
const reconcile = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    const checks = {
      cachedBalanceMismatch: `SELECT s.id, s.tenant_id, s.balance AS cached_balance, COALESCE(l.balance,0) AS ledger_balance
        FROM students s LEFT JOIN (SELECT tenant_id, student_id, SUM(debit-credit) AS balance FROM ledger_entries GROUP BY tenant_id,student_id) l
        ON l.student_id=s.id AND l.tenant_id=s.tenant_id WHERE ABS(s.balance-COALESCE(l.balance,0)) > 0.005`,
      invoiceChargeMismatch: `SELECT i.id, i.tenant_id, i.invoice_number, i.amount,
        COALESCE((SELECT SUM(l.debit-l.credit) FROM ledger_entries l WHERE l.tenant_id=i.tenant_id AND l.student_id=i.student_id
          AND l.entry_type='charge' AND (l.reference=i.invoice_number OR l.bill_id=i.invoice_number)),0) AS identifiable_charge
        FROM invoices i WHERE i.deleted_at IS NULL HAVING ABS(amount-identifiable_charge) > 0.005`,
      missingPaymentEvidence: `SELECT p.id, p.tenant_id, p.reference FROM payments p
        WHERE p.reversal_of_payment_id IS NULL AND p.status IN ('posted','reversed') AND (
          NOT EXISTS (SELECT 1 FROM payment_allocations a WHERE a.payment_id=p.id AND a.tenant_id=p.tenant_id)
          OR NOT EXISTS (SELECT 1 FROM transactions t WHERE t.tenant_id=p.tenant_id AND t.reference=p.reference)
          OR NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.tenant_id=p.tenant_id AND a.entity_id=p.id AND a.action='payment'))`,
      pendingWithPostedAllocation: `SELECT i.id, i.tenant_id, i.invoice_number FROM invoices i
        WHERE i.deleted_at IS NULL AND i.status != 'paid' AND EXISTS (
          SELECT 1 FROM payment_allocations a JOIN payments p ON p.id=a.payment_id AND p.status='posted' AND p.reversal_of_payment_id IS NULL
          WHERE a.tenant_id=i.tenant_id AND a.target_type='invoice' AND a.target_id=i.id)`,
    };
    const report = { generatedAt: new Date().toISOString(), readOnly: true, checks: {} };
    for (const [name, sql] of Object.entries(checks)) {
      const [[count]] = await connection.query(`SELECT COUNT(*) AS total FROM (${sql}) discrepancies`);
      const [sample] = await connection.query(`${sql} LIMIT 100`);
      report.checks[name] = { total: Number(count.total), sample, sampleLimit: 100 };
    }
    await connection.commit();
    return report;
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
};
if (require.main === module) {
  reconcile().then(report => {
    process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
    if (Object.values(report.checks).some(check => check.total > 0)) process.exitCode=2;
  }).catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode=1; }).finally(()=>pool.end());
}
module.exports = { reconcile };
