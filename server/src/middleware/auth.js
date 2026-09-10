const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../config/logger');
const { pool } = require('../config/database');
const { hashApiKey } = require('../services/apiKeyService');
const expectedApiKeyScope = config.appEnvironment === 'sandbox' ? 'test' : 'live';

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
      `SELECT u.id, u.tenant_id, u.email, u.name, u.role, u.school_access_role,
              u.school_ref, u.main_school_user_id, u.status, u.verified,
              t.name AS tenant_name, t.status AS tenant_status,
              t.lifecycle_stage AS tenant_lifecycle_stage,
              t.consumer_number_length
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id AND t.deleted_at IS NULL
       WHERE u.id = ? AND u.deleted_at IS NULL`,
      [decoded.userId]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = rows[0];
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is not active' });
    }
    if (user.tenant_id && !user.tenant_status) {
      return res.status(403).json({ error: 'Tenant account is unavailable', code: 'TENANT_NOT_FOUND' });
    }
    if (user.tenant_status === 'banned') {
      return res.status(403).json({ error: 'Tenant account is banned', code: 'TENANT_BANNED' });
    }
    if (user.tenant_status === 'suspended' && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return res.status(403).json({ error: 'Tenant account is suspended; dashboard access is read-only', code: 'TENANT_SUSPENDED' });
    }

    // Normalize legacy 'etea' role to 'org'
    if (user.role === 'etea') user.role = 'org';
    req.user = user;
    req.tenantId = user.tenant_id;
    if (user.tenant_id) {
      req.tenant = {
        id: user.tenant_id,
        name: user.tenant_name,
        status: user.tenant_status,
        lifecycleStage: user.tenant_lifecycle_stage,
        consumerNumberLength: Number(user.consumer_number_length),
      };
    }
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
    if (req.authType === 'apiKey' && req.tenantId) {
      return next();
    }
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.role === 'admin') return next();
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
      `SELECT id, name, status, lifecycle_stage, consumer_number_length
       FROM tenants WHERE api_key_hash = ? AND api_key_scope = ? AND deleted_at IS NULL AND status = 'active'`,
      [hashApiKey(apiKey), expectedApiKeyScope]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid API key' });

    req.tenantId = rows[0].id;
    req.authType = 'apiKey';
    req.tenant = rows[0];
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
        `SELECT id, name, status, lifecycle_stage, consumer_number_length
         FROM tenants WHERE api_key_hash = ? AND api_key_scope = ? AND deleted_at IS NULL AND status = 'active'`,
        [hashApiKey(apiKey), expectedApiKeyScope]
      );
      if (rows.length === 0) return res.status(401).json({ error: 'Invalid API key' });
      req.tenantId = rows[0].id;
      req.authType = 'apiKey';
      req.tenant = rows[0];
      return next();
    } catch (err) {
      logger.error('API key auth error:', err);
      return res.status(500).json({ error: 'Authentication failed' });
    }
  }
  return authenticate(req, res, next);
};

const tenantScope = async (req, res, next) => {
  // API key auth already resolved the tenant — skip JWT-based resolution
  if (req.tenantId) return next();

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

const requireLiveTenant = async (req, res, next) => {
  try {
    if (!req.tenantId) return res.status(400).json({ error: 'Tenant scope is required', code: 'TENANT_REQUIRED' });
    let tenant = req.tenant;
    if (!tenant || !tenant.status) {
      const [rows] = await pool.query(
        `SELECT id, name, status, lifecycle_stage, consumer_number_length
         FROM tenants WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [req.tenantId]
      );
      if (!rows.length) return res.status(404).json({ error: 'Tenant not found', code: 'TENANT_NOT_FOUND' });
      tenant = rows[0];
      req.tenant = tenant;
    }
    if (tenant.status !== 'active') {
      return res.status(403).json({ error: 'Tenant is suspended', code: 'TENANT_SUSPENDED' });
    }
    const lifecycle = tenant.lifecycleStage || tenant.lifecycle_stage;
    if (config.appEnvironment !== 'sandbox' && lifecycle !== 'live') {
      return res.status(403).json({ error: 'Tenant is still in testing and is not enabled for production payments', code: 'TENANT_NOT_LIVE' });
    }
    next();
  } catch (err) {
    logger.error('Tenant policy error:', err);
    res.status(500).json({ error: 'Unable to validate tenant state', code: 'TENANT_POLICY_ERROR' });
  }
};

module.exports = { authenticate, authorize, authorizeSchoolRole, apiKeyAuth, authenticateOrApiKey, tenantScope, requireLiveTenant };
