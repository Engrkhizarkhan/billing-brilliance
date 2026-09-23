const { pool } = require('../config/database');
const { subscribe } = require('../services/paymentEventBus');

const stream = (req, res) => {
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const send = (event, payload) => {
    if (res.writableEnded || res.destroyed) return;
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
  send('ready', { connected: true, tenantId: req.tenantId, timestamp: new Date().toISOString() });

  const unsubscribe = subscribe(req.tenantId, (payload) => send('payment', payload));
  const expiry = setTimeout(() => res.end(), Math.max(0, Math.min((req.authExpiresAt || Date.now() + 300000) - Date.now(), 300000)));
  const heartbeat = setInterval(async () => {
    try {
      const [[user]] = await pool.query(`SELECT u.status, u.auth_version, u.deleted_at, t.status AS tenant_status, t.deleted_at AS tenant_deleted
        FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id WHERE u.id = ?`, [req.user.id]);
      if (!user || user.status !== 'active' || user.deleted_at || Number(user.auth_version) !== Number(req.user.auth_version || 0)
        || (req.tenantId && (user.tenant_deleted || user.tenant_status === 'banned'))) return res.end();
      send('heartbeat', { timestamp: new Date().toISOString() });
    } catch { res.end(); }
  }, 25000);
  res.on('close', () => {
    clearInterval(heartbeat);
    clearTimeout(expiry);
    unsubscribe();
    res.end();
  });
};

module.exports = { stream };
