-- Migration 009: PCID API keys
-- Each unique PCID (1LINK biller code) gets its own API key.
-- biller_id is optional: set it to link a PCID to a tenant so that
-- the SaaS gateway APIs scope consumer queries to that tenant's students.

CREATE TABLE IF NOT EXISTS bundle_pcids (
  pcid       VARCHAR(8)   NOT NULL,
  api_key    VARCHAR(64)  NOT NULL,
  biller_id  VARCHAR(36)  NULL DEFAULT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (pcid),
  UNIQUE KEY  uk_bundle_pcids_api_key (api_key),
  INDEX       idx_bundle_pcids_biller  (biller_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
