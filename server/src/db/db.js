/**
 * CLI Database Connection Helper
 * Shared by migrate.js, seed.js, and reset.js.
 * Loads .env automatically — no need to call dotenv.config() in scripts that require this.
 */
const config = require('../config');
const mysql = require('mysql2/promise');
const DEFAULT_CFG = { ...config.db, timezone: '+00:00', dateStrings: true, multipleStatements: true };
delete DEFAULT_CFG.connectionLimit;

/**
 * createConnection(overrides?)
 * Returns a raw mysql2 connection.  Caller is responsible for calling conn.end().
 * @param {object} [overrides] - Any mysql2 connection options to override defaults.
 */
async function createConnection(overrides = {}) {
  const connection = await mysql.createConnection({ ...DEFAULT_CFG, ...overrides });
  await connection.query("SET time_zone = '+00:00'");
  return connection;
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
