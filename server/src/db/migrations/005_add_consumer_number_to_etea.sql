-- Migration 005: Add consumer_number to org_payment_records
-- Allows org payment records to be looked up via 1LINK BillInquiry/BillPayment
-- using the same consumer number format as school billing.

ALTER TABLE org_payment_records
  ADD COLUMN IF NOT EXISTS consumer_number VARCHAR(24) NULL UNIQUE AFTER bill_id;

ALTER TABLE org_payment_records
  ADD INDEX IF NOT EXISTS idx_org_consumer_number (consumer_number);
