-- Add per-tenant API key for external integrations (1BILL, etc.)
-- Each tenant gets a unique key generated at creation time; admin can regenerate it.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS api_key VARCHAR(64) NULL UNIQUE AFTER settings;

ALTER TABLE tenants
  ADD INDEX IF NOT EXISTS idx_tenants_api_key (api_key);
