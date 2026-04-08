const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');

const auditLog = async (req, action, entity, entityId, details) => {
  try {
    const userId = req.user?.id || 'system';
    const userName = req.user?.name || 'System';
    const tenantId = req.tenantId || req.user?.tenant_id || null;
    const ip = req.ip || req.connection?.remoteAddress || '0.0.0.0';
    const userAgent = req.headers?.['user-agent'] || null;

    await pool.query(
      `INSERT INTO audit_logs (id, tenant_id, user_id, user_name, action, entity, entity_id, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), tenantId, userId, userName, action, entity, entityId || '', details || '', ip, userAgent]
    );
  } catch (err) {
    // Audit logging should not fail the request
    console.error('Audit log error:', err.message);
  }
};

module.exports = { auditLog };
