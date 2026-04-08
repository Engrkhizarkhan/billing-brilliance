ALTER TABLE payment_plan_assignments
  ADD COLUMN assigned_via ENUM('class', 'individual') NOT NULL DEFAULT 'individual' AFTER status;