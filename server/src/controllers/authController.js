const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { pool } = require('../config/database');
const logger = require('../config/logger');
const { AppError } = require('../middleware/errorHandler');
const { auditLog } = require('../middleware/auditLog');
const { createNotification } = require('../services/notificationService');
const { isProtectedAdminUser } = require('../services/protectedAdmin');

// Parse a JWT duration string (e.g. "7d", "24h", "3600s") into milliseconds.
const parseDurationMs = (str) => {
  if (!str) return 7 * 24 * 60 * 60 * 1000; // default 7d
  const match = String(str).match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const n = parseInt(match[1], 10);
  const units = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * units[match[2]];
};

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id,
      schoolRef: user.school_ref,
      schoolAccessRole: user.school_access_role,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );

  return { accessToken, refreshToken };
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ? AND deleted_at IS NULL',
      [email]
    );

    if (rows.length === 0) {
      throw new AppError('Invalid credentials', 401, 'AUTH_FAILED');
    }

    const user = rows[0];

    if (user.status !== 'active') {
      throw new AppError('Account is not active', 403, 'ACCOUNT_INACTIVE');
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401, 'AUTH_FAILED');
    }

    const { accessToken, refreshToken } = generateTokens(user);

    // Store refresh token
    const expiresAt = new Date(Date.now() + parseDurationMs(config.jwt.refreshExpiresIn));
    await pool.query(
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [uuidv4(), user.id, refreshToken, expiresAt]
    );

    // Update last login
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    // Populate req.user/tenantId so auditLog records the correct user and tenant
    req.user = { id: user.id, name: user.name || user.email, role: user.role, tenant_id: user.tenant_id };
    req.tenantId = user.tenant_id || null;
    await auditLog(req, 'login', 'user', user.id, `User ${user.email} logged in`);
    await createNotification({
      tenantId: user.tenant_id || null,
      userId: user.id,
      title: 'Sign-in recorded',
      message: `You signed in to the ${user.role} portal.`,
      type: 'system',
    });

    const { password_hash, ...safeUser } = user;
    // Normalize legacy 'etea' role to 'org'
    if (safeUser.role === 'etea') safeUser.role = 'org';

    // Attach tenant API key so dashboard can display it in settings
    if (user.tenant_id) {
      const [tenantRows] = await pool.query(
        'SELECT api_key FROM tenants WHERE id = ? AND deleted_at IS NULL',
        [user.tenant_id]
      );
      safeUser.tenantApiKey = tenantRows[0]?.api_key || null;
    }

    res.json({
      data: {
        token: accessToken,
        refreshToken,
        user: safeUser,
      },
      message: 'Login successful',
    });
  } catch (err) {
    next(err);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      throw new AppError('Refresh token required', 400);
    }

    const decoded = jwt.verify(token, config.jwt.refreshSecret);

    const [rows] = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token = ? AND user_id = ? AND revoked_at IS NULL AND expires_at > NOW()',
      [token, decoded.userId]
    );

    if (rows.length === 0) {
      throw new AppError('Invalid refresh token', 401);
    }

    const [userRows] = await pool.query(
      `SELECT id, email, name, role, status, tenant_id, school_ref, school_access_role
       FROM users WHERE id = ? AND status = ? AND deleted_at IS NULL`,
      [decoded.userId, 'active']
    );

    if (userRows.length === 0) {
      throw new AppError('User not found', 401);
    }

    // Revoke old token
    await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = ?', [token]);

    const user = userRows[0];
    const tokens = generateTokens(user);

    // Store new refresh token
    const expiresAt = new Date(Date.now() + parseDurationMs(config.jwt.refreshExpiresIn));
    await pool.query(
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [uuidv4(), user.id, tokens.refreshToken, expiresAt]
    );

    res.json({
      data: {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (token) {
      await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = ?', [token]);
    }
    await auditLog(req, 'logout', 'user', req.user?.id, 'User logged out');
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

const getProfile = async (req, res, next) => {
  try {
  const { password_hash, ...safeUser } = req.user;
  void password_hash;
  if (req.user.tenant_id) {
    const [tenantRows] = await pool.query(
      'SELECT api_key FROM tenants WHERE id = ? AND deleted_at IS NULL',
      [req.user.tenant_id]
    );
    safeUser.tenantApiKey = tenantRows[0]?.api_key || null;
  }
  res.set('Cache-Control', 'no-store');
  res.json({ data: safeUser });
  } catch (err) {
    next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (isProtectedAdminUser(req.user)) {
      throw new AppError('Protected admin password is managed from environment variables', 403);
    }

    const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) throw new AppError('User not found', 404);

    const isValid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!isValid) throw new AppError('Current password is incorrect', 400);

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);

    // Revoke all refresh tokens
    await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ?', [req.user.id]);

    await auditLog(req, 'update', 'user', req.user.id, 'Password changed');
    await createNotification({
      tenantId: req.tenantId || null,
      userId: req.user.id,
      title: 'Password changed',
      message: 'Your password was updated successfully.',
      type: 'system',
    });

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/impersonate
 * Admin-only — generates a short-lived JWT for a target user without touching
 * that user's audit trail, last_login_at, or notifications.
 * Body: { userId: string }
 */
const impersonate = async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) throw new AppError('userId is required', 400);

    // Load target user
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE id = ? AND deleted_at IS NULL',
      [userId]
    );
    if (rows.length === 0) throw new AppError('User not found', 404);

    const target = rows[0];

    // Safety guards
    if (target.role === 'admin') {
      throw new AppError('Cannot impersonate another admin', 403);
    }
    if (target.status !== 'active') {
      throw new AppError('Target user account is not active', 403);
    }

    // Normalize legacy role
    if (target.role === 'etea') target.role = 'org';

    // Issue a short-lived impersonation token (30 min, no refresh)
    const impersonationToken = jwt.sign(
      {
        userId: target.id,
        email: target.email,
        role: target.role,
        tenantId: target.tenant_id,
        schoolRef: target.school_ref,
        schoolAccessRole: target.school_access_role,
        // Non-standard claims — used by the frontend banner only
        impersonated: true,
        impersonatedBy: req.user.id,
        impersonatedByEmail: req.user.email,
      },
      config.jwt.secret,
      { expiresIn: '30m' }
    );

    // Attach tenant API key so tenant pages work
    let tenantApiKey = null;
    if (target.tenant_id) {
      const [tenantRows] = await pool.query(
        'SELECT api_key FROM tenants WHERE id = ? AND deleted_at IS NULL',
        [target.tenant_id]
      );
      tenantApiKey = tenantRows[0]?.api_key || null;
    }

    // Audit the admin action — NOT the target user's login
    await auditLog(
      req,
      'impersonate',
      'user',
      target.id,
      `Admin ${req.user.email} started maintenance session as ${target.email} (${target.role})`
    );

    logger.info(`IMPERSONATION: admin ${req.user.email} → user ${target.email} (${target.role})`);

    const { password_hash, ...safeTarget } = target;
    void password_hash;

    return res.json({
      data: {
        token: impersonationToken,
        user: { ...safeTarget, tenantApiKey },
      },
      message: 'Impersonation session started',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, refreshToken, logout, getProfile, changePassword, impersonate };
