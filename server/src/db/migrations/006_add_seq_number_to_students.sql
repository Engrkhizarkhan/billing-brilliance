-- Migration 006: Add seq_number to students
-- Provides a per-tenant auto-incrementing sequence used to generate
-- consumer_number and bill_id without relying on AUTO_INCREMENT PKs.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS seq_number INT UNSIGNED NOT NULL DEFAULT 0 AFTER bill_id;

ALTER TABLE students
  ADD INDEX IF NOT EXISTS idx_students_seq (tenant_id, seq_number);
