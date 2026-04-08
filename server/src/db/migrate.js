require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config');
const logger = require('../config/logger');

const migrationsDir = path.join(__dirname, 'migrations');

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

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${config.db.database}\``);

    // Create migrations tracking table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const [executed] = await connection.query('SELECT name FROM _migrations ORDER BY id');
    const executedNames = new Set(executed.map(r => r.name));

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (executedNames.has(file)) {
        logger.info(`Skipping already executed: ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      logger.info(`Running migration: ${file}`);
      await connection.query(sql);
      await connection.query('INSERT INTO _migrations (name) VALUES (?)', [file]);
      logger.info(`Completed: ${file}`);
    }

    logger.info('All migrations executed successfully');
  } catch (err) {
    logger.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

migrate();
