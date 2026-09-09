-- =============================================================================
-- Fintap / 1BILL UAT: provision exactly 20 consumer-number test cases
-- Target schema: current billing-brilliance MySQL schema
-- Safe scope: dedicated tenant named Testing_UAT_1bill only
--
-- Case totals:
--   14 unpaid: two test cases in each of seven amount slabs
--    2 paid
--    1 after-due-date but still unpaid
--    2 blocked
--    1 unpaid consumer with exactly 24 digits
--
-- Slab assumption requiring confirmation from 1LINK:
--   The supplied ranges list six named ranges, while 14 unpaid cases require
--   seven slabs. This script infers 10,001-50,000 as the missing slab. It keeps
--   100,001-250,000 as a separate requested slab even though that label overlaps
--   the supplied 50,001-1,000,000 range. The actual chosen test amounts are all
--   distinct. Edit only the INSERT rows in uat_1bill_cases after 1LINK confirms
--   its official, non-overlapping slab boundaries.
--
-- IMPORTANT:
--   1. Take a database backup before running this on production.
--   2. Review @uat_tenant_name and @uat_biller_code below.
--   3. Never use a biller code that belongs to a real tenant.
--   4. This script does not delete or change non-UAT consumer records.
--   5. The script is idempotent: rerunning it refreshes these same 20 cases.
-- =============================================================================

USE Fintap;

-- Match the collation used by the current Fintap application tables. Without
-- this, MySQL 8 may create the temporary table with utf8mb4_0900_ai_ci and then
-- reject joins against utf8mb4_unicode_ci production columns.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET collation_connection = 'utf8mb4_unicode_ci';

SET @uat_tenant_name = 'Testing_UAT_1bill';
SET @uat_biller_code = '1001';
SET @fintech_prefix  = '105172';

DROP PROCEDURE IF EXISTS provision_1bill_uat_20;

DELIMITER $$

CREATE PROCEDURE provision_1bill_uat_20()
BEGIN
  DECLARE v_tenant_id VARCHAR(36) DEFAULT NULL;
  DECLARE v_tenant_status VARCHAR(20) DEFAULT NULL;
  DECLARE v_lifecycle_stage VARCHAR(30) DEFAULT NULL;
  DECLARE v_posting_id VARCHAR(36) DEFAULT NULL;
  DECLARE v_base VARCHAR(44);
  DECLARE v_case_count INT DEFAULT 0;
  DECLARE v_tenant_matches INT DEFAULT 0;
  DECLARE v_conflicts INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    DROP TEMPORARY TABLE IF EXISTS uat_1bill_cases;
    RESIGNAL;
  END;

  -- Validate the configurable prefix and biller code before any write.
  IF @fintech_prefix IS NULL
     OR @uat_biller_code IS NULL
     OR @fintech_prefix NOT REGEXP '^[0-9]+$'
     OR @uat_biller_code NOT REGEXP '^[0-9]+$' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'FINTECH prefix and UAT biller code must be numeric';
  END IF;

  SET v_base = CONCAT(@fintech_prefix, @uat_biller_code);
  IF CHAR_LENGTH(v_base) >= 20 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Prefix plus biller code is too long for standard 20-digit test consumers';
  END IF;

  -- Find an existing dedicated UAT tenant by name.
  SELECT COUNT(*), MAX(id), MAX(status), MAX(lifecycle_stage)
    INTO v_tenant_matches, v_tenant_id, v_tenant_status, v_lifecycle_stage
    FROM tenants
   WHERE name = @uat_tenant_name
     AND deleted_at IS NULL;

  IF v_tenant_matches > 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'More than one active record uses the configured UAT tenant name; resolve it before provisioning';
  END IF;

  -- Tenant creation and production activation must go through the audited admin
  -- workflow; this data script must never bypass that checklist.
  IF v_tenant_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Create the dedicated UAT tenant through Biller Management, activate it after checklist review, then rerun this script';
  END IF;

  -- Refuse to silently reactivate a deliberately suspended/banned test tenant.
  IF v_tenant_status <> 'active' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'The dedicated UAT tenant is not active; review its status before provisioning test cases';
  END IF;

  IF v_lifecycle_stage <> 'live' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'The dedicated UAT tenant is not live; complete the audited activation checklist first';
  END IF;

  -- The existing tenant name must also have the configured biller code.
  IF NOT EXISTS (
    SELECT 1
      FROM tenants
     WHERE id = v_tenant_id
       AND biller_code = @uat_biller_code
       AND deleted_at IS NULL
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'UAT tenant exists but its biller code differs from @uat_biller_code';
  END IF;

  DROP TEMPORARY TABLE IF EXISTS uat_1bill_cases;
  CREATE TEMPORARY TABLE uat_1bill_cases (
    case_no               TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    case_key              VARCHAR(60) NOT NULL UNIQUE,
    category              VARCHAR(40) NOT NULL,
    slab                  VARCHAR(80) NULL,
    consumer_number       VARCHAR(24) NOT NULL UNIQUE,
    amount                DECIMAL(15,2) NOT NULL,
    db_status             ENUM('pending','paid','failed','expired') NOT NULL,
    due_offset_days       INT NOT NULL,
    transaction_id       VARCHAR(100) NULL,
    expected_response_code CHAR(2) NOT NULL,
    expected_bill_status CHAR(1) NOT NULL
  ) ENGINE=InnoDB
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

  -- Standard cases use 20 digits. The final case uses exactly 24 digits.
  INSERT INTO uat_1bill_cases
    (case_no, case_key, category, slab, consumer_number, amount, db_status,
     due_offset_days, transaction_id, expected_response_code, expected_bill_status)
  VALUES
    ( 1, 'UNPAID-SLAB-1-A', 'Unpaid', 'Up to 5,000',
      CONCAT(v_base, LPAD(1, 20 - CHAR_LENGTH(v_base), '0')),
      1000.00, 'pending', 30, NULL, '00', 'U'),
    ( 2, 'UNPAID-SLAB-1-B', 'Unpaid', 'Up to 5,000',
      CONCAT(v_base, LPAD(2, 20 - CHAR_LENGTH(v_base), '0')),
      4999.00, 'pending', 30, NULL, '00', 'U'),

    ( 3, 'UNPAID-SLAB-2-A', 'Unpaid', '5,001 to 10,000',
      CONCAT(v_base, LPAD(3, 20 - CHAR_LENGTH(v_base), '0')),
      5001.00, 'pending', 30, NULL, '00', 'U'),
    ( 4, 'UNPAID-SLAB-2-B', 'Unpaid', '5,001 to 10,000',
      CONCAT(v_base, LPAD(4, 20 - CHAR_LENGTH(v_base), '0')),
      10000.00, 'pending', 30, NULL, '00', 'U'),

    ( 5, 'UNPAID-SLAB-3-A', 'Unpaid', '10,001 to 50,000 (inferred)',
      CONCAT(v_base, LPAD(5, 20 - CHAR_LENGTH(v_base), '0')),
      10001.00, 'pending', 30, NULL, '00', 'U'),
    ( 6, 'UNPAID-SLAB-3-B', 'Unpaid', '10,001 to 50,000 (inferred)',
      CONCAT(v_base, LPAD(6, 20 - CHAR_LENGTH(v_base), '0')),
      50000.00, 'pending', 30, NULL, '00', 'U'),

    ( 7, 'UNPAID-SLAB-4-A', 'Unpaid', '50,001 to 1,000,000',
      CONCAT(v_base, LPAD(7, 20 - CHAR_LENGTH(v_base), '0')),
      500000.00, 'pending', 30, NULL, '00', 'U'),
    ( 8, 'UNPAID-SLAB-4-B', 'Unpaid', '50,001 to 1,000,000',
      CONCAT(v_base, LPAD(8, 20 - CHAR_LENGTH(v_base), '0')),
      999999.00, 'pending', 30, NULL, '00', 'U'),

    ( 9, 'UNPAID-SLAB-5-A', 'Unpaid', '100,001 to 250,000 (requested overlap)',
      CONCAT(v_base, LPAD(9, 20 - CHAR_LENGTH(v_base), '0')),
      100001.00, 'pending', 30, NULL, '00', 'U'),
    (10, 'UNPAID-SLAB-5-B', 'Unpaid', '100,001 to 250,000 (requested overlap)',
      CONCAT(v_base, LPAD(10, 20 - CHAR_LENGTH(v_base), '0')),
      250000.00, 'pending', 30, NULL, '00', 'U'),

    (11, 'UNPAID-SLAB-6-A', 'Unpaid', '1,000,001 to 2,500,000',
      CONCAT(v_base, LPAD(11, 20 - CHAR_LENGTH(v_base), '0')),
      1000001.00, 'pending', 30, NULL, '00', 'U'),
    (12, 'UNPAID-SLAB-6-B', 'Unpaid', '1,000,001 to 2,500,000',
      CONCAT(v_base, LPAD(12, 20 - CHAR_LENGTH(v_base), '0')),
      2500000.00, 'pending', 30, NULL, '00', 'U'),

    (13, 'UNPAID-SLAB-7-A', 'Unpaid', '5,000,001 and above',
      CONCAT(v_base, LPAD(13, 20 - CHAR_LENGTH(v_base), '0')),
      5000001.00, 'pending', 30, NULL, '00', 'U'),
    (14, 'UNPAID-SLAB-7-B', 'Unpaid', '5,000,001 and above',
      CONCAT(v_base, LPAD(14, 20 - CHAR_LENGTH(v_base), '0')),
      6000000.00, 'pending', 30, NULL, '00', 'U'),

    (15, 'PAID-A', 'Paid', NULL,
      CONCAT(v_base, LPAD(15, 20 - CHAR_LENGTH(v_base), '0')),
      2500.00, 'paid', -10, '700001', '00', 'P'),
    (16, 'PAID-B', 'Paid', NULL,
      CONCAT(v_base, LPAD(16, 20 - CHAR_LENGTH(v_base), '0')),
      7500.00, 'paid', -10, '700002', '00', 'P'),

    (17, 'AFTER-DUE-DATE', 'After due date', NULL,
      CONCAT(v_base, LPAD(17, 20 - CHAR_LENGTH(v_base), '0')),
      15000.00, 'pending', -2, NULL, '00', 'U'),

    (18, 'BLOCKED-A', 'Blocked', NULL,
      CONCAT(v_base, LPAD(18, 20 - CHAR_LENGTH(v_base), '0')),
      75000.00, 'failed', 30, NULL, '02', 'B'),
    (19, 'BLOCKED-B', 'Blocked', NULL,
      CONCAT(v_base, LPAD(19, 20 - CHAR_LENGTH(v_base), '0')),
      300000.00, 'failed', 30, NULL, '02', 'B'),

    (20, 'CONSUMER-24-DIGIT', '24-digit unpaid', NULL,
      CONCAT(v_base, LPAD(20, 24 - CHAR_LENGTH(v_base), '0')),
      2000.00, 'pending', 30, NULL, '00', 'U');

  -- Assert the requested case counts before touching permanent payment tables.
  SELECT COUNT(*) INTO v_case_count FROM uat_1bill_cases;
  IF v_case_count <> 20 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Internal validation failed: expected 20 total cases';
  END IF;

  SELECT COUNT(*) INTO v_case_count
    FROM uat_1bill_cases
   WHERE category = 'Unpaid';
  IF v_case_count <> 14 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Internal validation failed: expected 14 slab-wise unpaid cases';
  END IF;

  SELECT COUNT(*) INTO v_case_count
    FROM uat_1bill_cases
   WHERE CHAR_LENGTH(consumer_number) = 24;
  IF v_case_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Internal validation failed: expected exactly one 24-digit consumer';
  END IF;

  -- Refuse to reuse any planned consumer number that belongs to a non-UAT row.
  SELECT COUNT(*) INTO v_conflicts
    FROM org_payment_records r
    JOIN uat_1bill_cases c ON c.consumer_number = r.consumer_number
   WHERE NOT (
     r.tenant_id = v_tenant_id
     AND r.application_id = CONCAT('1BILL-UAT-', LPAD(c.case_no, 2, '0'), '-', c.case_key)
   );
  IF v_conflicts > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'A planned UAT consumer number is already owned by another payment record';
  END IF;

  START TRANSACTION;

  -- Reuse or create the UAT posting for this dedicated tenant.
  SELECT MAX(id) INTO v_posting_id
    FROM org_postings
   WHERE tenant_id = v_tenant_id
     AND title = '1BILL UAT Certification Cases'
     AND deleted_at IS NULL;

  IF v_posting_id IS NULL THEN
    SET v_posting_id = UUID();
    INSERT INTO org_postings
      (id, tenant_id, title, type, department, total_seats, application_fee,
       start_date, end_date, test_date, status, applications_received)
    VALUES
      (v_posting_id, v_tenant_id, '1BILL UAT Certification Cases',
       'entry_test', 'Integration Testing', 20, 0,
       CURDATE(), DATE_ADD(CURDATE(), INTERVAL 90 DAY),
       DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'active', 20);
  ELSE
    UPDATE org_postings
       SET department = 'Integration Testing',
           total_seats = 20,
           status = 'active',
           applications_received = 20,
           deleted_at = NULL
     WHERE id = v_posting_id;
  END IF;

  INSERT INTO org_payment_records
    (id, tenant_id, application_id, applicant_id, posting_id, bill_id,
     consumer_number, amount, status, due_date, expiry_date, created_at,
     paid_at, transaction_id, description, callback_url)
  SELECT
    UUID(),
    v_tenant_id,
    CONCAT('1BILL-UAT-', LPAD(c.case_no, 2, '0'), '-', c.case_key),
    CONCAT('UAT-APPLICANT-', LPAD(c.case_no, 3, '0')),
    v_posting_id,
    CONCAT('ORG-UAT-', LPAD(c.case_no, 3, '0')),
    c.consumer_number,
    c.amount,
    c.db_status,
    DATE_ADD(CURDATE(), INTERVAL c.due_offset_days DAY),
    '2099-12-31 23:59:59',
    UTC_TIMESTAMP(),
    CASE WHEN c.db_status = 'paid' THEN UTC_TIMESTAMP() ELSE NULL END,
    c.transaction_id,
    CONCAT('UAT ', c.category, ' ', LPAD(c.case_no, 2, '0')),
    '/api/payment/callback'
  FROM uat_1bill_cases c
  ON DUPLICATE KEY UPDATE
    applicant_id   = VALUES(applicant_id),
    posting_id     = VALUES(posting_id),
    bill_id        = VALUES(bill_id),
    consumer_number= VALUES(consumer_number),
    amount         = VALUES(amount),
    status         = VALUES(status),
    due_date       = VALUES(due_date),
    expiry_date    = VALUES(expiry_date),
    paid_at        = VALUES(paid_at),
    transaction_id = VALUES(transaction_id),
    description    = VALUES(description),
    callback_url   = VALUES(callback_url);

  -- Keep the two paid fixtures internally consistent with payment history.
  INSERT INTO payments
    (id, tenant_id, student_id, consumer_number, amount, date, reference,
     voucher_number, channel, receipt_number, note)
  SELECT
    UUID(), v_tenant_id, NULL, c.consumer_number, c.amount, CURDATE(),
    CONCAT('UAT-', c.case_key), c.transaction_id, '1LINK-UAT',
    CONCAT('RCPT-UAT-', LPAD(c.case_no, 3, '0')), '1BILL UAT paid fixture'
  FROM uat_1bill_cases c
  WHERE c.db_status = 'paid'
  ON DUPLICATE KEY UPDATE
    consumer_number = VALUES(consumer_number),
    amount = VALUES(amount),
    date = VALUES(date),
    voucher_number = VALUES(voucher_number),
    channel = VALUES(channel),
    receipt_number = VALUES(receipt_number),
    note = VALUES(note);

  INSERT INTO transactions
    (id, tenant_id, transaction_id, consumer_number, amount, status, date,
     biller_name, channel, reference, notes)
  SELECT
    UUID(), v_tenant_id, c.transaction_id, c.consumer_number, c.amount,
    'completed', CURDATE(), @uat_tenant_name, '1LINK-UAT',
    CONCAT('UAT-', c.case_key), '1BILL UAT paid fixture'
  FROM uat_1bill_cases c
  WHERE c.db_status = 'paid'
  ON DUPLICATE KEY UPDATE
    consumer_number = VALUES(consumer_number),
    amount = VALUES(amount),
    status = VALUES(status),
    date = VALUES(date),
    biller_name = VALUES(biller_name),
    channel = VALUES(channel),
    reference = VALUES(reference),
    notes = VALUES(notes);

  -- Refresh only notifications belonging to these 20 UAT records.
  DELETE n
    FROM org_payment_notifications n
    JOIN org_payment_records r ON r.id = n.payment_id
    JOIN uat_1bill_cases c ON c.consumer_number = r.consumer_number
   WHERE r.tenant_id = v_tenant_id
     AND r.application_id = CONCAT('1BILL-UAT-', LPAD(c.case_no, 2, '0'), '-', c.case_key);

  INSERT INTO org_payment_notifications
    (id, tenant_id, application_id, payment_id, bill_id, status)
  SELECT
    UUID(), r.tenant_id, r.application_id, r.id, r.bill_id, r.status
  FROM org_payment_records r
  JOIN uat_1bill_cases c ON c.consumer_number = r.consumer_number
  WHERE r.tenant_id = v_tenant_id;

  -- Keep the shared allocator beyond the explicit UAT suffixes so a later API
  -- registration cannot generate the same 24-digit consumer identifier.
  UPDATE tenants
     SET next_consumer_sequence = GREATEST(next_consumer_sequence, 21)
   WHERE id = v_tenant_id;

  COMMIT;

  -- Final verification result. Save this output for the 1LINK handover.
  SELECT
    c.case_no,
    c.case_key,
    c.category,
    c.slab,
    r.consumer_number,
    CHAR_LENGTH(r.consumer_number) AS digits,
    r.amount AS amount_pkr,
    r.status AS database_status,
    r.due_date,
    r.expiry_date,
    c.expected_response_code,
    c.expected_bill_status,
    r.application_id,
    r.bill_id,
    r.transaction_id
  FROM uat_1bill_cases c
  JOIN org_payment_records r
    ON r.tenant_id = v_tenant_id
   AND r.consumer_number = c.consumer_number
  ORDER BY c.case_no;

  SELECT
    COUNT(*) AS total_cases,
    SUM(c.category = 'Unpaid') AS slab_unpaid_cases,
    SUM(c.category = 'Paid') AS paid_cases,
    SUM(c.category = 'After due date') AS after_due_cases,
    SUM(c.category = 'Blocked') AS blocked_cases,
    SUM(CHAR_LENGTH(c.consumer_number) = 24) AS consumers_with_24_digits
  FROM uat_1bill_cases c;

  DROP TEMPORARY TABLE IF EXISTS uat_1bill_cases;
END$$

DELIMITER ;

CALL provision_1bill_uat_20();
DROP PROCEDURE provision_1bill_uat_20;
