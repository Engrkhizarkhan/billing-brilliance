-- Migration 010: Add biller_id column to bundle_pcids
-- Migration 009 used CREATE TABLE IF NOT EXISTS, so if the table already
-- existed (without biller_id) the column was never added. This migration
-- adds the missing column and index idempotently.

ALTER TABLE bundle_pcids
  ADD COLUMN IF NOT EXISTS biller_id VARCHAR(36) NULL DEFAULT NULL;

-- Add index idempotently via prepared statement (avoids DELIMITER / stored-proc syntax)
SELECT COUNT(*) INTO @_bpi_exists
  FROM INFORMATION_SCHEMA.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME   = 'bundle_pcids'
   AND INDEX_NAME   = 'idx_bundle_pcids_biller';

SET @_bpi_sql = IF(
  @_bpi_exists = 0,
  'ALTER TABLE bundle_pcids ADD INDEX idx_bundle_pcids_biller (biller_id)',
  'SELECT 1 -- index already exists'
);
PREPARE _bpi_stmt FROM @_bpi_sql;
EXECUTE _bpi_stmt;
DEALLOCATE PREPARE _bpi_stmt;
