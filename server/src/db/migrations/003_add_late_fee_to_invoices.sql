-- Migration 003: Add per-invoice fee_plan_id and late_fee columns
-- fee_plan_id: links each invoice to its source fee plan so multi-plan students
--   get one invoice per plan per month (not one total invoice).
-- late_fee: stores the fee plan's configured late fee at generation time.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS fee_plan_id VARCHAR(36) NULL AFTER student_id;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS late_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER amount;
ALTER TABLE invoices ADD INDEX IF NOT EXISTS idx_invoices_fee_plan (fee_plan_id);
