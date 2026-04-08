const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../config/logger');
const { pool } = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);

    // Verify user still exists and is active
    const [rows] = await pool.query(
      'SELECT id, tenant_id, email, name, role, school_access_role, school_ref, main_school_user_id, status, verified FROM users WHERE id = ? AND deleted_at IS NULL',
      [decoded.userId]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = rows[0];
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is not active' });
    }

    req.user = user;
    req.tenantId = user.tenant_id;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    logger.error('Authentication error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

const authorizeSchoolRole = (...schoolRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.role !== 'school') {
      return res.status(403).json({ error: 'School access required' });
    }
    if (schoolRoles.length > 0 && !schoolRoles.includes(req.user.school_access_role)) {
      return res.status(403).json({ error: 'Insufficient school permissions' });
    }
    next();
  };
};

const apiKeyAuth = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return res.status(401).json({ error: 'API key required' });

    const [rows] = await pool.query(
      "SELECT id FROM tenants WHERE api_key = ? AND deleted_at IS NULL AND status = 'active'",
      [apiKey]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid API key' });

    req.tenantId = rows[0].id;
    next();
  } catch (err) {
    logger.error('API key auth error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

// Accepts either a valid JWT Bearer token (internal users) or an x-api-key (external integrations)
const authenticateOrApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    try {
      const [rows] = await pool.query(
        "SELECT id FROM tenants WHERE api_key = ? AND deleted_at IS NULL AND status = 'active'",
        [apiKey]
      );
      if (rows.length === 0) return res.status(401).json({ error: 'Invalid API key' });
      req.tenantId = rows[0].id;
      return next();
    } catch (err) {
      logger.error('API key auth error:', err);
      return res.status(500).json({ error: 'Authentication failed' });
    }
  }
  return authenticate(req, res, next);
};

const tenantScope = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  // Platform admins can access all tenants
  if (req.user.role === 'admin') {
    // Admin can set tenant via query/header for scoped access
    req.tenantId = req.query.tenant_id || req.headers['x-tenant-id'] || null;
    return next();
  }
  // Non-admin users must have a tenant
  if (!req.user.tenant_id) {
    try {
      const schoolRef = req.user.school_ref;
      if (schoolRef) {
        const parsedCode = schoolRef.startsWith('SCH-') ? schoolRef.slice(4) : schoolRef;
        const [tenantRows] = await pool.query(
          'SELECT id FROM tenants WHERE biller_code = ? AND deleted_at IS NULL LIMIT 1',
          [parsedCode]
        );

        if (tenantRows.length > 0) {
          req.tenantId = tenantRows[0].id;
          await pool.query('UPDATE users SET tenant_id = ? WHERE id = ? AND tenant_id IS NULL', [req.tenantId, req.user.id]);
          return next();
        }
      }
    } catch (err) {
      logger.error('Tenant resolution error:', err);
    }

    return res.status(403).json({ error: 'No tenant associated with this user' });
  }
  req.tenantId = req.user.tenant_id;
  next();
};

module.exports = { authenticate, authorize, authorizeSchoolRole, apiKeyAuth, authenticateOrApiKey, tenantScope };
