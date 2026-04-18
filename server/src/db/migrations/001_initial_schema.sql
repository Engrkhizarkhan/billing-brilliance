-- Payniva - Full Database Schema
-- Multi-Tenant Education & Org Payment Platform

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 1. TENANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type ENUM('school', 'org', 'private_agency') NOT NULL,
  biller_code VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  status ENUM('active', 'suspended', 'banned') NOT NULL DEFAULT 'active',
  settings JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_tenants_type (type),
  INDEX idx_tenants_status (status),
  INDEX idx_tenants_biller_code (biller_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. ROLES & PERMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description VARCHAR(255),
  is_system TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_permissions_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id VARCHAR(36) NOT NULL,
  permission_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role ENUM('admin', 'school', 'org') NOT NULL,
  school_access_role ENUM('admin', 'finance', 'staff', 'viewer') NULL,
  school_ref VARCHAR(50) NULL,
  main_school_user_id VARCHAR(36) NULL,
  status ENUM('active', 'suspended', 'banned') NOT NULL DEFAULT 'active',
  verified TINYINT(1) DEFAULT 0,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uk_users_email (email),
  INDEX idx_users_tenant (tenant_id),
  INDEX idx_users_role (role),
  INDEX idx_users_status (status),
  INDEX idx_users_school_ref (school_ref),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL,
  FOREIGN KEY (main_school_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id VARCHAR(36) NOT NULL,
  role_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. STUDENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  father_name VARCHAR(255) NOT NULL,
  roll_number VARCHAR(50),
  class VARCHAR(50) NOT NULL,
  section VARCHAR(10),
  phone VARCHAR(20),
  cnic VARCHAR(15),
  consumer_number VARCHAR(24) NOT NULL,
  bill_id VARCHAR(50) NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  balance DECIMAL(15, 2) DEFAULT 0.00,
  admission_date DATE,
  gender ENUM('male', 'female') NOT NULL,
  date_of_birth DATE,
  address TEXT,
  uses_bus_service TINYINT(1) DEFAULT 0,
  bus_service_start_month VARCHAR(7) NULL,
  bus_service_end_month VARCHAR(7) NULL,
  bus_monthly_fee DECIMAL(10, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uk_students_consumer (consumer_number),
  UNIQUE KEY uk_students_bill (bill_id),
  INDEX idx_students_tenant (tenant_id),
  INDEX idx_students_class (class),
  INDEX idx_students_cnic (cnic),
  INDEX idx_students_status (status),
  INDEX idx_students_roll (roll_number),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. FEE HEADS
-- ============================================================
CREATE TABLE IF NOT EXISTS fee_heads (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  frequency ENUM('monthly', 'quarterly', 'annual', 'one-time') NOT NULL,
  applicable_classes JSON,
  due_day INT DEFAULT 10,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_fee_heads_tenant (tenant_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. FEE PLANS
-- ============================================================
CREATE TABLE IF NOT EXISTS fee_plans (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  frequency ENUM('monthly', 'quarterly', 'yearly') NOT NULL,
  due_day INT DEFAULT 10,
  late_fee DECIMAL(10, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_fee_plans_tenant (tenant_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. SCHOLARSHIPS
-- ============================================================
CREATE TABLE IF NOT EXISTS scholarships (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type ENUM('percentage', 'fixed') NOT NULL,
  value DECIMAL(15, 2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  is_lifetime TINYINT(1) DEFAULT 0,
  status ENUM('active', 'expired', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_scholarships_tenant (tenant_id),
  INDEX idx_scholarships_status (status),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS student_scholarship_assignments (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  student_id VARCHAR(36) NOT NULL,
  scholarship_id VARCHAR(36) NOT NULL,
  effective_from DATE NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  INDEX idx_ssa_tenant (tenant_id),
  INDEX idx_ssa_student (student_id),
  UNIQUE KEY uk_ssa_student_scholarship (student_id, scholarship_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (scholarship_id) REFERENCES scholarships(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  invoice_number VARCHAR(50) NOT NULL,
  student_id VARCHAR(36) NULL,
  student_name VARCHAR(255),
  consumer_number VARCHAR(24),
  month VARCHAR(20),
  amount DECIMAL(15, 2) NOT NULL,
  status ENUM('pending', 'paid', 'overdue') NOT NULL DEFAULT 'pending',
  due_date DATE NOT NULL,
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uk_invoices_number_tenant (invoice_number, tenant_id),
  INDEX idx_invoices_tenant (tenant_id),
  INDEX idx_invoices_student (student_id),
  INDEX idx_invoices_consumer (consumer_number),
  INDEX idx_invoices_status (status),
  INDEX idx_invoices_due_date (due_date),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 9. TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  transaction_id VARCHAR(100) NOT NULL,
  consumer_number VARCHAR(24),
  amount DECIMAL(15, 2) NOT NULL,
  status ENUM('completed', 'pending', 'failed') NOT NULL DEFAULT 'pending',
  date DATE NOT NULL,
  biller_name VARCHAR(255),
  channel VARCHAR(50) NULL,
  reference VARCHAR(100) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_transactions_txn_id_tenant (transaction_id, tenant_id),
  INDEX idx_transactions_tenant (tenant_id),
  INDEX idx_transactions_consumer (consumer_number),
  INDEX idx_transactions_status (status),
  INDEX idx_transactions_date (date),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 10. LEDGER ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS ledger_entries (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  student_id VARCHAR(36) NOT NULL,
  date DATE NOT NULL,
  description VARCHAR(500) NOT NULL,
  fee_head_id VARCHAR(36) NULL,
  debit DECIMAL(15, 2) DEFAULT 0.00,
  credit DECIMAL(15, 2) DEFAULT 0.00,
  balance DECIMAL(15, 2) DEFAULT 0.00,
  bill_id VARCHAR(50),
  reference VARCHAR(100),
  entry_type ENUM('charge', 'payment', 'adjustment') NOT NULL DEFAULT 'charge',
  allocations JSON NULL,
  gross_tuition DECIMAL(15, 2) NULL,
  scholarship_discount DECIMAL(15, 2) NULL,
  net_tuition DECIMAL(15, 2) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ledger_tenant (tenant_id),
  INDEX idx_ledger_student (student_id),
  INDEX idx_ledger_date (date),
  INDEX idx_ledger_entry_type (entry_type),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (fee_head_id) REFERENCES fee_heads(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 11. PAYMENTS (Bill Payments Records)
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  student_id VARCHAR(36) NULL,
  consumer_number VARCHAR(24),
  amount DECIMAL(15, 2) NOT NULL,
  date DATE NOT NULL,
  reference VARCHAR(100),
  voucher_number VARCHAR(50),
  channel VARCHAR(50),
  receipt_number VARCHAR(100),
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payments_tenant (tenant_id),
  INDEX idx_payments_student (student_id),
  INDEX idx_payments_consumer (consumer_number),
  INDEX idx_payments_reference (reference),
  UNIQUE KEY uk_payments_reference_tenant (reference, tenant_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 12. ORG POSTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS org_postings (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  type ENUM('entry_test', 'job_vacancy') NOT NULL,
  department VARCHAR(255),
  total_seats INT DEFAULT 0,
  application_fee DECIMAL(10, 2) DEFAULT 0.00,
  start_date DATE,
  end_date DATE,
  test_date DATE,
  status ENUM('draft', 'active', 'closed') NOT NULL DEFAULT 'draft',
  applications_received INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_postings_tenant (tenant_id),
  INDEX idx_postings_status (status),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 13. APPLICANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS applicants (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  father_name VARCHAR(255) NOT NULL,
  cnic VARCHAR(15) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  district VARCHAR(100),
  gender ENUM('male', 'female') NOT NULL,
  date_of_birth DATE,
  qualification VARCHAR(100),
  consumer_number VARCHAR(24) NOT NULL,
  bill_id VARCHAR(50) NOT NULL,
  payment_status ENUM('paid', 'pending', 'partial') NOT NULL DEFAULT 'pending',
  application_status ENUM('submitted', 'fee_pending', 'fee_paid', 'roll_assigned', 'test_scheduled', 'appeared', 'result_pending', 'selected', 'rejected') NOT NULL DEFAULT 'submitted',
  service_id VARCHAR(36),
  roll_number VARCHAR(50),
  test_center VARCHAR(255),
  marks DECIMAL(6, 2) NULL,
  applied_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uk_applicants_consumer (consumer_number),
  UNIQUE KEY uk_applicants_bill (bill_id),
  INDEX idx_applicants_tenant (tenant_id),
  INDEX idx_applicants_cnic (cnic),
  INDEX idx_applicants_status (application_status),
  INDEX idx_applicants_service (service_id),
  INDEX idx_applicants_payment (payment_status),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 14. SERVICES (Org)
-- ============================================================
CREATE TABLE IF NOT EXISTS services (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  payment_type ENUM('one-time', 'multiple', 'recurring') NOT NULL DEFAULT 'one-time',
  amount DECIMAL(15, 2) NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_services_tenant (tenant_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 15. ORG PAYMENT RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS org_payment_records (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  application_id VARCHAR(100) NOT NULL,
  applicant_id VARCHAR(36) NOT NULL,
  posting_id VARCHAR(36) NOT NULL,
  bill_id VARCHAR(100) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  status ENUM('pending', 'paid', 'failed', 'expired') NOT NULL DEFAULT 'pending',
  due_date DATE NOT NULL,
  expiry_date DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMP NULL,
  transaction_id VARCHAR(100) NULL,
  description TEXT,
  callback_url VARCHAR(500),
  UNIQUE KEY uk_org_pay_app (application_id, tenant_id),
  UNIQUE KEY uk_org_pay_bill (bill_id),
  INDEX idx_org_pay_tenant (tenant_id),
  INDEX idx_org_pay_status (status),
  INDEX idx_org_pay_applicant (applicant_id),
  INDEX idx_org_pay_txn (transaction_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 16. ORG PAYMENT NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS org_payment_notifications (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  application_id VARCHAR(100) NOT NULL,
  payment_id VARCHAR(36) NOT NULL,
  bill_id VARCHAR(100) NOT NULL,
  status ENUM('pending', 'paid', 'failed', 'expired') NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_org_notif_tenant (tenant_id),
  INDEX idx_org_notif_payment (payment_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 17. CALLBACK IDEMPOTENCY LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS callback_idempotency_log (
  idempotency_key VARCHAR(255) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  response JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_callback_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 18. BILL BUNDLES
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_bundles (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  frequency ENUM('monthly', 'quarterly', 'yearly', 'one-time') NOT NULL,
  description TEXT,
  due_day INT NULL,
  late_fee DECIMAL(10, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_bundles_tenant (tenant_id),
  UNIQUE KEY uk_bundles_code_tenant (code, tenant_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 19. PAYMENT PLAN ASSIGNMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_plan_assignments (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  student_id VARCHAR(36) NOT NULL,
  fee_plan_id VARCHAR(36) NOT NULL,
  status ENUM('active', 'pending', 'completed') NOT NULL DEFAULT 'pending',
  assigned_date DATE NOT NULL,
  next_due_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ppa_tenant (tenant_id),
  INDEX idx_ppa_student (student_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (fee_plan_id) REFERENCES fee_plans(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 20. AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NULL,
  user_id VARCHAR(36) NULL,
  user_name VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(100) NOT NULL,
  entity_id VARCHAR(100),
  details TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_tenant (tenant_id),
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_entity (entity),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 21. NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NULL,
  user_id VARCHAR(36) NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  type ENUM('payment', 'applicant', 'alert', 'system') NOT NULL DEFAULT 'system',
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_tenant (tenant_id),
  INDEX idx_notif_user (user_id),
  INDEX idx_notif_read (is_read),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 22. SETTINGS (key-value store per tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  `key` VARCHAR(100) NOT NULL,
  value JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_settings_key_tenant (`key`, tenant_id),
  INDEX idx_settings_tenant (tenant_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 23. REFRESH TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token VARCHAR(500) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL,
  INDEX idx_refresh_user (user_id),
  INDEX idx_refresh_token (token(255)),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
