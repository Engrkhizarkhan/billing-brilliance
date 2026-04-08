/**
 * Database Reset Script
 * Clears all seeded data and keeps only the admin@example.com user.
 * Usage: node src/db/reset.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mysql = require('mysql2/promise');
const config = require('../config');
const logger = require('../config/logger');

async function reset() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true,
  });

  try {
    logger.info('Starting database reset...');

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // --- Transactional / operational tables ---
    const truncateTables = [
      'callback_idempotency_log',
      'etea_payment_notifications',
      'etea_payment_records',
      'audit_logs',
      'notifications',
      'refresh_tokens',
      'settings',
      'ledger_entries',
      'payments',
      'payment_plan_assignments',
      'student_scholarship_assignments',
      'invoices',
      'transactions',
      'bill_bundles',
      'applicants',
      'services',
      'etea_postings',
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

    // --- Remove all users except admin@example.com ---
    const [result] = await connection.query(
      "DELETE FROM users WHERE email != 'admin@example.com'"
    );
    logger.info(`Deleted ${result.affectedRows} user(s) (kept admin@example.com)`);

    // --- Remove all tenants ---
    await connection.query('TRUNCATE TABLE tenants');
    logger.info('Truncated: tenants');

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    // --- Verify admin user is intact ---
    const [adminRows] = await connection.query(
      "SELECT id, email, name, role, status FROM users WHERE email = 'admin@example.com'"
    );
    if (adminRows.length === 1) {
      logger.info(`Admin user preserved: ${adminRows[0].email} (role: ${adminRows[0].role}, status: ${adminRows[0].status})`);
    } else {
      logger.warn('WARNING: admin@example.com was not found after reset!');
    }

    logger.info('Database reset complete. Only admin@example.com remains.');
  } catch (err) {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
    logger.error('Reset failed:', err.message);
    throw err;
  } finally {
    await connection.end();
  }
}

reset().catch((err) => {
  console.error(err);
  process.exit(1);
});
