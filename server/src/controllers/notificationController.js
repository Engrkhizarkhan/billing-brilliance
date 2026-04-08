const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');

const buildNotificationScope = (req) => {
  let where = 'WHERE 1=1';
  const params = [];

  if (req.user) {
    where += ' AND (user_id = ? OR user_id IS NULL)';
    params.push(req.user.id);
  }
  if (req.tenantId) {
    where += ' AND (tenant_id = ? OR tenant_id IS NULL)';
    params.push(req.tenantId);
  }

  return { where, params };
};

const fetchNotifications = async (req, res, next) => {
  try {
    const { where, params } = buildNotificationScope(req);

    const [rows] = await pool.query(
      `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT 50`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const { where, params } = buildNotificationScope(req);
    await pool.query(`UPDATE notifications SET is_read = 1 ${where} AND id = ?`, [...params, req.params.id]);
    res.json({ data: true, message: 'Notification marked as read' });
  } catch (err) {
    next(err);
  }
};

const markAllRead = async (req, res, next) => {
  try {
    const { where, params } = buildNotificationScope(req);

    await pool.query(`UPDATE notifications SET is_read = 1 ${where} AND is_read = 0`, params);
    res.json({ data: true, message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
};

const deleteNotification = async (req, res, next) => {
  try {
    const { where, params } = buildNotificationScope(req);
    await pool.query(`DELETE FROM notifications ${where} AND id = ?`, [...params, req.params.id]);
    res.json({ data: true, message: 'Notification deleted' });
  } catch (err) {
    next(err);
  }
};

const clearNotifications = async (req, res, next) => {
  try {
    const { where, params } = buildNotificationScope(req);
    await pool.query(`DELETE FROM notifications ${where}`, params);
    res.json({ data: true, message: 'Notifications cleared' });
  } catch (err) {
    next(err);
  }
};

module.exports = { fetchNotifications, markAsRead, markAllRead, deleteNotification, clearNotifications };
