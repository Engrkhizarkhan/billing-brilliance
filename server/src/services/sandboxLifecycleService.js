const config = require('../config');
const { AppError } = require('../middleware/errorHandler');

const sandboxRequest = async (path, payload) => {
  if (!config.sandbox.baseUrl || !config.sandbox.purgeSecret) {
    if (config.nodeEnv === 'production') throw new AppError('Sandbox lifecycle service is not configured', 503, 'SANDBOX_NOT_CONFIGURED');
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${config.sandbox.baseUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Sandbox-Admin-Secret': config.sandbox.purgeSecret },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new AppError(body.error || 'Sandbox lifecycle request failed', 502, 'SANDBOX_LIFECYCLE_FAILED');
    return body.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Sandbox lifecycle service is unavailable', 503, 'SANDBOX_UNAVAILABLE');
  } finally { clearTimeout(timeout); }
};

const provisionSandboxTenant = (tenant) => sandboxRequest('/internal/sandbox/tenants/provision', tenant);
const purgeSandboxTenant = (tenantId) => sandboxRequest(`/internal/sandbox/tenants/${encodeURIComponent(tenantId)}/purge`, {});

module.exports = { provisionSandboxTenant, purgeSandboxTenant };
