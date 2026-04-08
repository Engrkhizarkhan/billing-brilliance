-- Migration 005: Add consumer_number to etea_payment_records
-- Allows ETEA payment records to be looked up via 1LINK BillInquiry/BillPayment
-- using the same consumer number format as school billing.

ALTER TABLE etea_payment_records
  ADD COLUMN IF NOT EXISTS consumer_number VARCHAR(24) NULL UNIQUE AFTER bill_id;

ALTER TABLE etea_payment_records
  ADD INDEX IF NOT EXISTS idx_etea_consumer_number (consumer_number);
