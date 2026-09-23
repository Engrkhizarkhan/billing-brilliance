const config = require('../config');
const { assertDisposableDatabase } = require('../services/disposableDatabaseGuard');
/**
 * Database Reset Script
 * Clears application/test data and keeps every platform administrator.
 * Usage:  node src/db/reset.js
 * Also exported as a function for use by:  node src/db/seed.js --fresh
 */
const { createConnection } = require('./db');    // also loads .env
const logger = require('../config/logger');

async function reset() {
  assertDisposableDatabase(config);
  const connection = await createConnection();

  try {
    logger.info('Starting database reset...');

    // Refuse to mutate anything unless an active, unscoped platform
    // administrator will remain able to sign in after the reset.
    const [adminRowsBeforeReset] = await connection.query(
      `SELECT id, email FROM users
       WHERE role = 'admin' AND status = 'active' AND tenant_id IS NULL AND deleted_at IS NULL`
    );
    if (adminRowsBeforeReset.length === 0) {
      throw new Error('Reset refused: no active unscoped platform administrator exists');
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // --- Transactional / operational tables ---
    const truncateTables = [
      'callback_idempotency_log',
      'org_payment_notifications',
      'org_payment_records',
      'outbox_events',
      'audit_logs',
      'notifications',
      'refresh_tokens',
      'settings',
      'ledger_entries',
      'payment_allocations',
      'payments',
      'payment_plan_assignments',
      'student_scholarship_assignments',
      'invoices',
      'transactions',
      'bundle_pcids',
      'bill_bundles',
      'bundles',
      'applicants',
      'services',
      'org_postings',
      'scholarships',
      'fee_heads',
      'fee_plans',
      'students',
      'user_roles',
    ];

    for (const table of truncateTables) {
      await connection.query(`TRUNCATE TABLE \`${table}\``);
      logger.info(`Truncated: ${table}`);
    }

    // --- Remove tenant users; platform administrators are deliberately kept ---
    const [result] = await connection.query(
      "DELETE FROM users WHERE role <> 'admin' OR role IS NULL"
    );
    logger.info(`Deleted ${result.affectedRows} tenant user(s); preserved platform administrators`);

    // --- Remove all tenants ---
    await connection.query('TRUNCATE TABLE tenants');
    logger.info('Truncated: tenants');

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    // --- Verify at least one usable platform administrator is intact ---
    const [adminRows] = await connection.query(
      `SELECT id, email, name, role, status FROM users
       WHERE role = 'admin' AND status = 'active' AND tenant_id IS NULL AND deleted_at IS NULL`
    );
    if (adminRows.length > 0) {
      logger.info(`Preserved ${adminRows.length} active platform administrator(s)`);
    } else {
      throw new Error('Reset verification failed: no active platform administrator remains');
    }

    logger.info('Database reset complete. Platform administrators and structural authorization data remain.');
  } catch (err) {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
    logger.error('Reset failed:', err.message);
    throw err;
  } finally {
    await connection.end();
  }
}

module.exports = reset;

if (require.main === module) {
  reset().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
