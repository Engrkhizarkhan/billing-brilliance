require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config');
const logger = require('../config/logger');

const SCHEMA_FILE = path.join(__dirname, 'schema.sql');
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

const ensureColumn = async (connection, table, column, definition) => {
  const [rows] = await connection.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [config.db.database, table, column]
  );
  if (rows.length === 0) {
    await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    logger.info(`Added ${table}.${column}`);
  }
};

const ensureIndex = async (connection, table, indexName, definition) => {
  const [rows] = await connection.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [config.db.database, table, indexName]
  );
  if (rows.length === 0) {
    await connection.query(`ALTER TABLE \`${table}\` ADD ${definition}`);
    logger.info(`Added index ${indexName} on ${table}`);
  }
};

const ensureUniqueColumnIndex = async (connection, table, column, indexName) => {
  const [rows] = await connection.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? AND NON_UNIQUE = 0 LIMIT 1`,
    [config.db.database, table, column]
  );
  if (rows.length === 0) {
    await connection.query(`ALTER TABLE \`${table}\` ADD UNIQUE KEY \`${indexName}\` (\`${column}\`)`);
    logger.info(`Added unique index ${indexName} on ${table}.${column}`);
  }
};

async function migrate() {
  const isFresh = process.argv.includes('--fresh');

  if (isFresh && config.nodeEnv === 'production') {
    throw new Error('Fresh database migration is disabled when NODE_ENV=production');
  }

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

    const [databaseRows] = await connection.query(
      'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ? LIMIT 1',
      [config.db.database]
    );
    if (databaseRows.length === 0 && config.nodeEnv === 'production') {
      throw new Error(`Production database ${config.db.database} does not exist; refusing to create an empty replacement`);
    }
    if (databaseRows.length === 0) {
      await connection.query(
        `CREATE DATABASE \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
    }
    await connection.query(`USE \`${config.db.database}\``);

    logger.info(`Applying schema: ${SCHEMA_FILE}`);
    const sql = fs.readFileSync(SCHEMA_FILE, 'utf8');
    await connection.query(sql);
    logger.info('Schema applied successfully');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(100) PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

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

    // CREATE TABLE IF NOT EXISTS does not upgrade existing installations.
    // Apply the additive production schema changes explicitly and idempotently.
    await ensureColumn(connection, 'org_payment_records', 'consumer_number', 'VARCHAR(24) NULL AFTER `bill_id`');
    await ensureUniqueColumnIndex(connection, 'org_payment_records', 'consumer_number', 'uk_org_payment_consumer');
    await ensureColumn(connection, 'students', 'seq_number', 'INT UNSIGNED NOT NULL DEFAULT 0 AFTER `bill_id`');
    await ensureIndex(connection, 'students', 'idx_students_seq', 'INDEX `idx_students_seq` (`tenant_id`, `seq_number`)');

    const crypto = require('crypto');
    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter((file) => /^\d+.*\.js$/.test(file))
      .sort();
    for (const file of migrationFiles) {
      const migrationPath = path.join(MIGRATIONS_DIR, file);
      const checksum = crypto.createHash('sha256').update(fs.readFileSync(migrationPath)).digest('hex');
      const [applied] = await connection.query(
        'SELECT checksum FROM schema_migrations WHERE version = ? LIMIT 1', [file]
      );
      if (applied.length > 0) {
        if (applied[0].checksum !== checksum) {
          throw new Error(`Applied migration ${file} has changed; restore the original file and add a new migration`);
        }
        continue;
      }
      const migration = require(migrationPath);
      await migration.up({ connection, ensureColumn, ensureIndex, ensureUniqueColumnIndex });
      await connection.query(
        'INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)', [file, checksum]
      );
      logger.info(`Applied migration ${file}`);
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

