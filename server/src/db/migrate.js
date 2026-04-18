require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config');
const logger = require('../config/logger');

const SCHEMA_FILE = path.join(__dirname, 'schema.sql');

async function migrate() {
  const isFresh = process.argv.includes('--fresh');

  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });

  try {
    if (isFresh) {
      logger.info('Fresh migration: dropping and recreating database...');
      await connection.query(`DROP DATABASE IF EXISTS \`${config.db.database}\``);
    }

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.query(`USE \`${config.db.database}\``);

    logger.info(`Applying schema: ${SCHEMA_FILE}`);
    const sql = fs.readFileSync(SCHEMA_FILE, 'utf8');
    await connection.query(sql);
    logger.info('Schema applied successfully');

    // Auto-migrate existing databases: rename legacy etea_* tables if present
    const legacyTables = [
      { old: 'etea_postings',              new: 'org_postings' },
      { old: 'etea_payment_records',       new: 'org_payment_records' },
      { old: 'etea_payment_notifications', new: 'org_payment_notifications' },
    ];
    for (const t of legacyTables) {
      const [rows] = await connection.query(`SHOW TABLES LIKE '${t.old}'`);
      if (rows.length > 0) {
        await connection.query(`RENAME TABLE \`${t.old}\` TO \`${t.new}\``);
        logger.info(`Renamed legacy table: ${t.old} → ${t.new}`);
      }
    }

    // Normalize legacy 'etea' role / type values
    await connection.query("UPDATE users   SET role = 'org' WHERE role = 'etea'");
    await connection.query("UPDATE tenants SET type = 'org' WHERE type = 'etea'");

    logger.info('Migration complete');
  } catch (err) {
    logger.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

migrate();

