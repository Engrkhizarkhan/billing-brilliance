const mysql = require('mysql2/promise');
const config = require('./index');
const logger = require('./logger');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  connectionLimit: config.db.connectionLimit,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: '+00:00',
  dateStrings: true,
});

pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+00:00'");
  logger.debug('New database connection established');
});

const testConnection = async () => {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    logger.info('Database connection successful');
    return true;
  } catch (err) {
    logger.error('Database connection failed:', err.message);
    return false; // caller (startServer) checks return value and exits
  }
};

module.exports = { pool, testConnection };
