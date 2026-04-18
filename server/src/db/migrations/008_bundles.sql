-- 1LINK FetchBundle — bundles table
-- Stores bundles per PCID (Company UCID) as per 1LINK Generic REST Spec v1.5

CREATE TABLE IF NOT EXISTS bundles (
  id          VARCHAR(36)   PRIMARY KEY,
  pcid        VARCHAR(8)    NOT NULL,                  -- Company UCID e.g. MBLINK01
  biller_name VARCHAR(30)   NOT NULL,                  -- Spec: String(A) 30
  bundle_id   VARCHAR(20)   NOT NULL,                  -- Unique ID within a PCID
  bundle_name VARCHAR(100)  NOT NULL,
  description VARCHAR(500)  NULL,
  expiry_date VARCHAR(20)   NULL,                      -- Stored as DD-MON-YY string per spec e.g. 27-MAR-22
  amount      VARCHAR(20)   NOT NULL,                  -- Stored as string per spec
  tag         VARCHAR(2000) NULL,                      -- Spec max 2000: category, validity, details, additional info, reserved
  status      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at  TIMESTAMP     NULL DEFAULT NULL,
  UNIQUE KEY  uk_bundle_pcid_bundleid (pcid, bundle_id),
  INDEX       idx_bundles_pcid (pcid),
  INDEX       idx_bundles_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
