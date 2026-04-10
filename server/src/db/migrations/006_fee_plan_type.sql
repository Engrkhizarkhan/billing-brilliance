-- Add plan_type to fee_plans to distinguish tuition (recurring, 1-per-student)
-- from additional service charges (gym, books, stationery, etc., multiple per student)
-- Also extend frequency ENUM to include 'one-time' for service charges

ALTER TABLE fee_plans
  ADD COLUMN plan_type ENUM('tuition', 'additional') NOT NULL DEFAULT 'tuition' AFTER late_fee;

ALTER TABLE fee_plans
  MODIFY COLUMN frequency ENUM('monthly', 'quarterly', 'yearly', 'one-time') NOT NULL;
