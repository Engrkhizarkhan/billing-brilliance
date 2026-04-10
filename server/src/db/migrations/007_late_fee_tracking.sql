-- Migration 007: Late fee tracking
-- late_fee_applied: flags whether the per-invoice late fee has been posted to
--   the ledger so we never double-charge the same invoice.
-- Adds 'late_fee' as a distinct entry_type so the frontend can style it
--   separately from a regular 'charge' and payment rows can be tagged
--   as on-time / late based on whether a matching late_fee entry exists.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS late_fee_applied TINYINT(1) NOT NULL DEFAULT 0 AFTER late_fee;

ALTER TABLE ledger_entries
  MODIFY COLUMN entry_type
    ENUM('charge', 'payment', 'adjustment', 'late_fee') NOT NULL DEFAULT 'charge';
