const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { auditLog } = require('../middleware/auditLog');
const { createNotification } = require('../services/notificationService');
const {
  assertNotProtectedAdminUser,
  decorateProtectedUser,
  decorateProtectedUsers,
} = require('../services/protectedAdmin');

const fetchUsers = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 25, role, status, search } = req.query;
    const offset = (page - 1) * pageSize;

    let where = 'WHERE u.deleted_at IS NULL';
    const params = [];

    // Tenant scoping
    if (req.user.role !== 'admin' && req.tenantId) {
      where += ' AND u.tenant_id = ?';
      params.push(req.tenantId);
    }

    if (role) { where += ' AND u.role = ?'; params.push(role); }
    if (status) { where += ' AND u.status = ?'; params.push(status); }
    if (search) {
      where += ' AND (u.name LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM users u ${where}`, params);
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT u.id, u.tenant_id, u.email, u.name, u.role, u.school_access_role, u.school_ref, u.main_school_user_id,
              u.status, u.verified, u.last_login_at, u.created_at,
              t.name AS tenant_name, t.biller_code
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id AND t.deleted_at IS NULL
       ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );

    res.json({
      data: decorateProtectedUsers(rows),
      meta: { page: parseInt(page), pageSize: parseInt(pageSize), total },
    });
  } catch (err) {
    next(err);
  }
};

const getUser = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, tenant_id, email, name, role, school_access_role, school_ref, main_school_user_id, status, verified, last_login_at, created_at
       FROM users WHERE id = ? AND deleted_at IS NULL`,
      [req.params.id]
    );

    if (rows.length === 0) throw new AppError('User not found', 404);

    // Tenant check
    if (req.user.role !== 'admin' && req.tenantId && rows[0].tenant_id !== req.tenantId) {
      throw new AppError('Access denied', 403);
    }

    res.json({ data: decorateProtectedUser(rows[0]) });
  } catch (err) {
    next(err);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { email, name, role, password, schoolRef, schoolAccessRole, tenantId: bodyTenantId } = req.body;

    // Check duplicate email
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? AND deleted_at IS NULL', [email]);
    if (existing.length > 0) throw new AppError('A user with this email already exists', 409);

    const id = uuidv4();
    const rawPassword = password || `ChangeMe!123-${Math.random().toString(36).slice(2, 4)}`;
    const passwordHash = await bcrypt.hash(rawPassword, 12);

    let tenantId = bodyTenantId || req.tenantId || null;

    let tenant = null;
    if (!tenantId && role !== 'admin' && schoolRef) {
      const parsedCode = schoolRef.startsWith('SCH-') ? schoolRef.slice(4) : schoolRef;
      const [tenantRows] = await pool.query('SELECT id, biller_code FROM tenants WHERE biller_code = ? AND deleted_at IS NULL LIMIT 1', [parsedCode]);
      if (tenantRows.length > 0) {
        tenantId = tenantRows[0].id;
        tenant = tenantRows[0];
      }
    }

    if (role !== 'admin' && !tenantId) {
      throw new AppError('Tenant is required for non-admin users', 400);
    }

    if (tenantId && !tenant) {
      const [tenantRows] = await pool.query('SELECT id, biller_code FROM tenants WHERE id = ? AND deleted_at IS NULL LIMIT 1', [tenantId]);
      if (tenantRows.length === 0) {
        throw new AppError('Tenant not found', 404);
      }
      tenant = tenantRows[0];
    }

    const isSchool = role === 'school';
    const resolvedSchoolRef = isSchool ? (schoolRef || `SCH-${tenant?.biller_code || Date.now()}`) : null;
    const resolvedSchoolAccessRole = isSchool ? (schoolAccessRole || 'admin') : null;

    await pool.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, name, role, school_access_role, school_ref, main_school_user_id, status, verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1)`,
      [id, tenantId, email, passwordHash, name, role, resolvedSchoolAccessRole, resolvedSchoolRef, isSchool ? id : null]
    );

    await auditLog(req, 'create', 'user', id, `User ${email} created with role ${role}`);
    await createNotification({
      tenantId,
      userId: role === 'admin' ? id : null,
      title: 'User account created',
      message: `${name} (${role}) was provisioned on the platform.`,
      type: 'system',
    });

    const [rows] = await pool.query(
      `SELECT u.id, u.tenant_id, u.email, u.name, u.role, u.school_access_role, u.school_ref, u.status, u.verified, u.created_at,
              t.name AS tenant_name, t.biller_code
       FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id AND t.deleted_at IS NULL
       WHERE u.id = ?`,
      [id]
    );

    res.status(201).json({
      data: { user: decorateProtectedUser(rows[0]), defaultPassword: rawPassword },
      message: 'User created',
    });
  } catch (err) {
    next(err);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended', 'banned'].includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (rows.length === 0) throw new AppError('User not found', 404);
    assertNotProtectedAdminUser(rows[0], 'status-updated');

    if (req.user.role !== 'admin' && req.tenantId && rows[0].tenant_id !== req.tenantId) {
      throw new AppError('Access denied', 403);
    }

    await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
    await auditLog(req, 'update', 'user', req.params.id, `Status changed to ${status}`);
    await createNotification({
      tenantId: rows[0].tenant_id || null,
      userId: rows[0].id,
      title: 'Account status changed',
      message: `Your account status is now ${status}.`,
      type: 'alert',
    });

    res.json({ data: decorateProtectedUser({ ...rows[0], status, password_hash: undefined }), message: 'Status updated' });
  } catch (err) {
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      throw new AppError('Password must be at least 6 characters', 400);
    }

    const [rows] = await pool.query('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (rows.length === 0) throw new AppError('User not found', 404);

    const [userRows] = await pool.query('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    assertNotProtectedAdminUser(userRows[0], 'password-reset');

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.params.id]);
    await auditLog(req, 'update', 'user', req.params.id, 'Password reset by admin');
    await createNotification({
      tenantId: userRows[0].tenant_id || null,
      userId: userRows[0].id,
      title: 'Password reset',
      message: 'An administrator reset your password.',
      type: 'alert',
    });

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (rows.length === 0) throw new AppError('User not found', 404);

    const target = rows[0];
    assertNotProtectedAdminUser(target, 'deleted');
    if (target.id === req.user.id) throw new AppError('You cannot delete your own account', 400);

    await pool.query('UPDATE users SET deleted_at = NOW(), status = ? WHERE id = ?', ['banned', target.id]);
    await auditLog(req, 'delete', 'user', target.id, `User ${target.email} soft-deleted by administrator`);

    res.json({ data: true, message: 'User deleted' });
  } catch (err) {
    next(err);
  }
};

const fetchSchoolUsers = async (req, res, next) => {
  try {
    const schoolRef = req.params.schoolRef || req.user.school_ref;
    if (!schoolRef) throw new AppError('School reference required', 400);

    // Verify caller has access to this school
    if (req.user.role !== 'admin' && req.user.school_ref !== schoolRef) {
      throw new AppError('Access denied', 403);
    }

    const [rows] = await pool.query(
      `SELECT id, tenant_id, email, name, role, school_access_role, school_ref, main_school_user_id, status, verified, created_at
       FROM users WHERE school_ref = ? AND role = 'school' AND deleted_at IS NULL`,
      [schoolRef]
    );

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const createSchoolSubUser = async (req, res, next) => {
  try {
    const { name, email, password, schoolRef, mainSchoolUserId, schoolAccessRole } = req.body;

    const resolvedSchoolRef = schoolRef || req.user.school_ref;
    if (!resolvedSchoolRef) throw new AppError('School reference required', 400);

    let resolvedTenantId = req.tenantId;
    if (!resolvedTenantId) {
      const parsedCode = resolvedSchoolRef.startsWith('SCH-') ? resolvedSchoolRef.slice(4) : resolvedSchoolRef;
      const [tenantRows] = await pool.query('SELECT id FROM tenants WHERE biller_code = ? AND deleted_at IS NULL LIMIT 1', [parsedCode]);
      if (tenantRows.length > 0) {
        resolvedTenantId = tenantRows[0].id;
      }
    }

    if (!resolvedTenantId) {
      throw new AppError('Tenant is required for school sub-user', 400);
    }

    // Verify caller is school admin of this school
    if (req.user.role !== 'admin') {
      if (req.user.school_ref !== resolvedSchoolRef || req.user.school_access_role !== 'admin') {
        throw new AppError('Only school admins can create sub-users', 403);
      }
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? AND deleted_at IS NULL', [email]);
    if (existing.length > 0) throw new AppError('A user with this email already exists', 409);

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password || 'ChangeMe!123', 12);
    const resolvedMainId = mainSchoolUserId || req.user.id;

    await pool.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, name, role, school_access_role, school_ref, main_school_user_id, status, verified)
       VALUES (?, ?, ?, ?, ?, 'school', ?, ?, ?, 'active', 0)`,
      [id, resolvedTenantId, email, passwordHash, name, schoolAccessRole || 'staff', resolvedSchoolRef, resolvedMainId]
    );

    await auditLog(req, 'create', 'user', id, `School sub-user ${email} created`);

    const [rows] = await pool.query(
      'SELECT id, tenant_id, email, name, role, school_access_role, school_ref, main_school_user_id, status, verified FROM users WHERE id = ?',
      [id]
    );

    res.status(201).json({ data: rows[0], message: 'School sub-user created' });
  } catch (err) {
    next(err);
  }
};

const deleteSchoolUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const schoolRef = req.query.schoolRef || req.user.school_ref;

    const [rows] = await pool.query(
      "SELECT * FROM users WHERE id = ? AND school_ref = ? AND role = 'school' AND deleted_at IS NULL",
      [id, schoolRef]
    );
    if (rows.length === 0) throw new AppError('School user not found', 404);

    if (rows[0].school_access_role === 'admin') {
      const [admins] = await pool.query(
        "SELECT COUNT(*) as cnt FROM users WHERE school_ref = ? AND school_access_role = 'admin' AND role = 'school' AND deleted_at IS NULL",
        [schoolRef]
      );
      if (admins[0].cnt <= 1) throw new AppError('At least one school admin is required', 400);
    }

    await pool.query('UPDATE users SET deleted_at = NOW() WHERE id = ?', [id]);
    await auditLog(req, 'delete', 'user', id, `School user deleted`);

    res.json({ data: true, message: 'School user deleted' });
  } catch (err) {
    next(err);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, verified, schoolAccessRole } = req.body;

    const [rows] = await pool.query('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL', [id]);
    if (rows.length === 0) throw new AppError('User not found', 404);
    assertNotProtectedAdminUser(rows[0], 'updated');

    if (req.user.role !== 'admin' && req.tenantId && rows[0].tenant_id !== req.tenantId) {
      throw new AppError('Access denied', 403);
    }

    if (email && email !== rows[0].email) {
      const [dup] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ? AND deleted_at IS NULL', [email, id]);
      if (dup.length > 0) throw new AppError('Another user already has this email', 409);
    }

    const fields = [];
    const values = [];

    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (email !== undefined) { fields.push('email = ?'); values.push(email); }
    if (verified !== undefined) { fields.push('verified = ?'); values.push(verified ? 1 : 0); }
    if (schoolAccessRole !== undefined) { fields.push('school_access_role = ?'); values.push(schoolAccessRole); }

    if (fields.length === 0) throw new AppError('No fields to update', 400);

    values.push(id);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    await auditLog(req, 'update', 'user', id, `User updated: ${fields.join(', ')}`);

    const [updated] = await pool.query(
      `SELECT u.id, u.tenant_id, u.email, u.name, u.role, u.school_access_role, u.school_ref, u.main_school_user_id,
              u.status, u.verified, u.created_at, t.name AS tenant_name, t.biller_code
       FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id AND t.deleted_at IS NULL
       WHERE u.id = ?`,
      [id]
    );

    res.json({ data: decorateProtectedUser(updated[0]), message: 'User updated' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  fetchUsers, getUser, createUser, updateUser, updateUserStatus, resetPassword, deleteUser,
  fetchSchoolUsers, createSchoolSubUser, deleteSchoolUser,
};
