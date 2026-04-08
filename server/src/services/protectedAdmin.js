const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../config/logger');
const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const getProtectedAdminConfig = () => {
  const email = normalizeEmail(config.admin.email);
  const password = String(config.admin.password || '');

  if (!email || !password) {
    return null;
  }

  return {
    email,
    password,
    name: String(config.admin.name || 'Platform Administrator').trim() || 'Platform Administrator',
  };
};

const isProtectedAdminEmail = (email) => {
  const protectedAdmin = getProtectedAdminConfig();
  if (!protectedAdmin) return false;
  return normalizeEmail(email) === protectedAdmin.email;
};

const isProtectedAdminUser = (user) => isProtectedAdminEmail(user?.email);

const decorateProtectedUser = (user) => ({
  ...user,
  is_protected: isProtectedAdminUser(user),
});

const decorateProtectedUsers = (users) => users.map((user) => decorateProtectedUser(user));

const assertNotProtectedAdminUser = (user, action) => {
  if (!isProtectedAdminUser(user)) return;
  throw new AppError(`Protected admin account cannot be ${action}`, 403);
};

const ensureProtectedAdmin = async () => {
  const protectedAdmin = getProtectedAdminConfig();
  if (!protectedAdmin) {
    logger.warn('Protected admin bootstrap skipped: ADMIN_EMAIL or ADMIN_PASSWORD is missing');
    return;
  }

  const passwordHash = await bcrypt.hash(protectedAdmin.password, 12);
  const [rows] = await pool.query(
    'SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1',
    [protectedAdmin.email]
  );

  if (rows.length === 0) {
    const id = uuidv4();
    await pool.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, name, role, school_access_role, school_ref, main_school_user_id, status, verified)
       VALUES (?, NULL, ?, ?, ?, 'admin', NULL, NULL, NULL, 'active', 1)`,
      [id, protectedAdmin.email, passwordHash, protectedAdmin.name]
    );
    logger.info(`Protected admin bootstrapped for ${protectedAdmin.email}`);
    return;
  }

  await pool.query(
    `UPDATE users
     SET tenant_id = NULL,
         email = ?,
         password_hash = ?,
         name = ?,
         role = 'admin',
         school_access_role = NULL,
         school_ref = NULL,
         main_school_user_id = NULL,
         status = 'active',
         verified = 1,
         deleted_at = NULL
     WHERE id = ?`,
    [protectedAdmin.email, passwordHash, protectedAdmin.name, rows[0].id]
  );

  logger.info(`Protected admin synced for ${protectedAdmin.email}`);
};

module.exports = {
  decorateProtectedUser,
  decorateProtectedUsers,
  assertNotProtectedAdminUser,
  ensureProtectedAdmin,
  getProtectedAdminConfig,
  isProtectedAdminEmail,
  isProtectedAdminUser,
};