const crypto = require('crypto');
const config = require('../config');
const logger = require('../config/logger');
const { pool, testConnection } = require('../config/database');
const { assertSafePublicHttpsUrl } = require('../services/urlSafety');

const pollMs = Math.max(500, Number(process.env.OUTBOX_POLL_MS) || 2000);
const maxAttempts = Math.max(1, Number(process.env.OUTBOX_MAX_ATTEMPTS) || 10);
let stopping = false;
let working = false;

const parseSettings = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
};

const claimEvent = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT * FROM outbox_events
       WHERE ((status IN ('pending','failed') AND available_at <= UTC_TIMESTAMP())
          OR (status = 'processing' AND (processing_started_at IS NULL
              OR processing_started_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 MINUTE))))
         AND attempts < ?
       ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED`,
      [maxAttempts]
    );
    if (!rows.length) {
      await connection.commit();
      return null;
    }
    const event = rows[0];
    await connection.query(
      `UPDATE outbox_events SET status = 'processing', attempts = attempts + 1,
         processing_started_at = UTC_TIMESTAMP(), last_error = NULL
       WHERE id = ?`, [event.id]
    );
    await connection.commit();
    return { ...event, attempts: Number(event.attempts) + 1 };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const markDelivered = (eventId) => pool.query(
  `UPDATE outbox_events SET status = 'delivered', processed_at = UTC_TIMESTAMP(),
     processing_started_at = NULL, last_error = NULL
   WHERE id = ?`, [eventId]
);

const markFailed = (event, error) => {
  const retrySeconds = Math.min(3600, 2 ** Math.min(event.attempts, 10) * 15);
  return pool.query(
    `UPDATE outbox_events SET status = 'failed', processing_started_at = NULL,
       available_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND), last_error = ?
     WHERE id = ?`,
    [retrySeconds, String(error.message || error).slice(0, 4000), event.id]
  );
};

const deliver = async (event) => {
  const [tenants] = await pool.query(
    'SELECT settings FROM tenants WHERE id = ? AND deleted_at IS NULL LIMIT 1', [event.tenant_id]
  );
  if (!tenants.length) throw new Error('Tenant no longer exists');
  const settings = parseSettings(tenants[0].settings);
  const notificationUrl = settings.notification_url;
  if (!notificationUrl) return markDelivered(event.id);

  const safeUrl = await assertSafePublicHttpsUrl(notificationUrl);
  const parsedPayload = typeof event.payload === 'object' ? event.payload : JSON.parse(event.payload);
  const body = JSON.stringify({
    event_id: event.id,
    event_type: event.event_type,
    created_at: event.created_at,
    data: parsedPayload,
  });
  const secret = settings.webhook_secret || config.org.webhookSecret;
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const response = await fetch(safeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Fintap-Event-Id': event.id,
      'X-Webhook-Signature': signature,
    },
    body,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}`);
  await markDelivered(event.id);
};

const tick = async () => {
  if (stopping || working) return;
  working = true;
  try {
    const event = await claimEvent();
    if (event) {
      try { await deliver(event); }
      catch (error) {
        await markFailed(event, error);
        logger.warn(`Outbox delivery failed event=${event.id} attempt=${event.attempts}: ${error.message}`);
      }
    }
  } catch (error) {
    logger.error('Outbox worker tick failed:', error);
  } finally {
    working = false;
  }
};

const stop = async (signal) => {
  stopping = true;
  logger.info(`Outbox worker stopping (${signal})`);
  while (working) await new Promise((resolve) => setTimeout(resolve, 50));
  await pool.end();
  process.exit(0);
};

if (require.main === module) {
  testConnection().then((connected) => {
    if (!connected) throw new Error('Database connection failed');
    logger.info(`Outbox worker started (poll=${pollMs}ms, maxAttempts=${maxAttempts})`);
    setInterval(tick, pollMs);
    void tick();
  }).catch((error) => {
    logger.error('Outbox worker startup failed:', error);
    process.exit(1);
  });
  process.on('SIGTERM', () => { void stop('SIGTERM'); });
  process.on('SIGINT', () => { void stop('SIGINT'); });
}

module.exports = { claimEvent, deliver, markFailed };
