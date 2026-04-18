/**
 * CLI Database Connection Helper
 * Shared by migrate.js, seed.js, and reset.js.
 * Loads .env automatically — no need to call dotenv.config() in scripts that require this.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const mysql = require('mysql2/promise');

const DEFAULT_CFG = {
  host:               process.env.DB_HOST     || 'localhost',
  port:               Number(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'payniva',
  multipleStatements: true,
};

/**
 * createConnection(overrides?)
 * Returns a raw mysql2 connection.  Caller is responsible for calling conn.end().
 * @param {object} [overrides] - Any mysql2 connection options to override defaults.
 */
async function createConnection(overrides = {}) {
  return mysql.createConnection({ ...DEFAULT_CFG, ...overrides });
}

/**
 * withConnection(fn, overrides?)
 * Calls fn(connection) then closes the connection — even if fn throws.
 * @param {(conn: import('mysql2/promise').Connection) => Promise<any>} fn
 * @param {object} [overrides]
 */
async function withConnection(fn, overrides = {}) {
  const conn = await createConnection(overrides);
  try {
    return await fn(conn);
  } finally {
    await conn.end();
  }
}

module.exports = { createConnection, withConnection, DEFAULT_CFG };
