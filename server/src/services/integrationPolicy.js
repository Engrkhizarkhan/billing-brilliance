const net = require('net');
const config = require('../config');
const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const normalizeIp = value => {
  const ip = String(value || '').replace(/^::ffff:/i, '');
  if (!net.isIP(ip)) return '';
  return net.isIPv6(ip) ? new URL(`http://[${ip}]/`).hostname : ip;
};
const assertIntegrationPolicy = async (req, tenantId) => {
  if (req.user || req.integrationPolicyChecked) return;
  if (config.requireHttps && req.protocol !== 'https') throw new AppError('HTTPS is required', 403, 'HTTPS_REQUIRED');
  if (config.appEnvironment === 'sandbox') return;
  const [[row]] = await pool.query("SELECT value FROM settings WHERE tenant_id = ? AND `key` IN ('org_security_context', 'etea_security_context') ORDER BY `key` = 'org_security_context' DESC LIMIT 1", [tenantId]);
  let settings = row?.value || {};
  if (typeof settings === 'string') { try { settings = JSON.parse(settings); } catch { settings = {}; } }
  const raw = settings.sourceIp || [];
  const ips = (Array.isArray(raw) ? raw : String(raw).split(',')).map(value => normalizeIp(String(value).trim())).filter(Boolean);
  if (!ips.length && config.nodeEnv === 'production') throw new AppError('Source IP allowlist is not configured', 503, 'IP_ALLOWLIST_REQUIRED');
  if (ips.length && !ips.includes(normalizeIp(req.ip || req.socket?.remoteAddress))) throw new AppError('Source IP not whitelisted', 403, 'IP_BLOCKED');
  req.integrationPolicyChecked = true;
};
const verifiedPostingOnly = (req, res, next) => {
  if (req.user?.role === 'admin' || (config.appEnvironment === 'sandbox' && req.authType === 'apiKey')) return next();
  return res.status(403).json({ error: 'Production payments require verified gateway confirmation or platform administrator verification', code: 'VERIFIED_PAYMENT_REQUIRED' });
};
module.exports = { assertIntegrationPolicy, verifiedPostingOnly, normalizeIp };
