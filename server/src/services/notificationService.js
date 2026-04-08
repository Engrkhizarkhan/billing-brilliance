const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');

const createNotification = async ({ tenantId = null, userId = null, title, message = '', type = 'system' }) => {
  if (!title) return false;

  try {
    await pool.query(
      `INSERT INTO notifications (id, tenant_id, user_id, title, message, type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), tenantId, userId, title, message, type]
    );
    return true;
  } catch (err) {
    console.error('Notification error:', err.message);
    return false;
  }
};

const createRequestNotification = async (req, payload) => {
  return createNotification({
    tenantId: payload.tenantId !== undefined ? payload.tenantId : (req.tenantId || req.user?.tenant_id || null),
    userId: payload.userId !== undefined ? payload.userId : null,
    title: payload.title,
    message: payload.message,
    type: payload.type,
  });
};

module.exports = { createNotification, createRequestNotification };