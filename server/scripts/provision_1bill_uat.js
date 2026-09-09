const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/database');
const config = require('../src/config');

const TENANT_NAME = process.env.UAT_TENANT_NAME || 'Testing_UAT_1bill';
const OUTPUT_PATH = process.env.UAT_OUTPUT_PATH || '/root/1bill-files/1bill-uat-consumers.csv';
const POSTING_ID = '1b111111-1111-4111-8111-111111111111';

const pad = (value) => String(value).padStart(2, '0');
const mysqlDate = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
const mysqlDateTime = (date) => `${mysqlDate(date)} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const buildCases = (base) => {
  const standardWidth = 20 - base.length;
  const longWidth = 24 - base.length;
  if (standardWidth < 1 || longWidth < 1) throw new Error('Prefix and biller code are too long');

  const standardConsumer = (sequence) => `${base}${String(sequence).padStart(standardWidth, '0')}`;
  const longConsumer = (sequence) => `${base}${String(sequence).padStart(longWidth, '0')}`;
  const cases = [];
  const provisionalAmounts = [4999, 7500, 25000, 750000, 175000, 1500000, 5500000];

  let sequence = 1;
  provisionalAmounts.forEach((amount, slabIndex) => {
    ['A', 'B'].forEach((variant) => {
      cases.push({
        key: `UNPAID-SLAB-${slabIndex + 1}-${variant}`,
        category: `Unpaid provisional slab ${slabIndex + 1}`,
        consumerNumber: standardConsumer(sequence++),
        amount,
        status: 'pending',
        expectedCode: '00',
        expectedBillStatus: 'U',
        dueOffsetDays: 30,
      });
    });
  });

  ['A', 'B'].forEach((variant, index) => {
    cases.push({
      key: `PAID-${variant}`,
      category: 'Paid',
      consumerNumber: standardConsumer(sequence++),
      amount: index === 0 ? 2500 : 7500,
      status: 'paid',
      expectedCode: '00',
      expectedBillStatus: 'P',
      dueOffsetDays: -10,
      transactionId: String(700001 + index),
    });
  });

  cases.push({
    key: 'AFTER-DUE-DATE',
    category: 'After due date',
    consumerNumber: standardConsumer(sequence++),
    amount: 1500,
    status: 'pending',
    expectedCode: '00',
    expectedBillStatus: 'U',
    dueOffsetDays: -2,
  });

  ['A', 'B'].forEach((variant) => {
    cases.push({
      key: `BLOCKED-${variant}`,
      category: 'Blocked',
      consumerNumber: standardConsumer(sequence++),
      amount: 3000,
      status: 'failed',
      expectedCode: '02',
      expectedBillStatus: 'B',
      dueOffsetDays: 30,
    });
  });

  cases.push({
    key: 'CONSUMER-24-DIGIT',
    category: '24-digit unpaid consumer',
    consumerNumber: longConsumer(20),
    amount: 2000,
    status: 'pending',
    expectedCode: '00',
    expectedBillStatus: 'U',
    dueOffsetDays: 30,
  });

  return cases;
};

const csvEscape = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const main = async () => {
  const connection = await pool.getConnection();
  let cases;
  let connectionReleased = false;

  try {
    const [tenantRows] = await connection.query(
      'SELECT id, name, biller_code, lifecycle_stage FROM tenants WHERE name = ? AND status = ? AND deleted_at IS NULL LIMIT 1',
      [TENANT_NAME, 'active']
    );
    if (tenantRows.length !== 1) throw new Error(`Active tenant not found: ${TENANT_NAME}`);

    const tenant = tenantRows[0];
    if (config.appEnvironment === 'production' && tenant.lifecycle_stage !== 'live') {
      throw new Error('Dedicated UAT tenant is not activated for 1LINK traffic; complete the audited activation checklist first');
    }
    const base = `${config.fintechPrefix}${tenant.biller_code}`;
    if (!/^\d+$/.test(base)) throw new Error('Prefix and biller code must both be numeric');
    cases = buildCases(base);
    if (cases.length !== 20) throw new Error(`Expected 20 cases, generated ${cases.length}`);

    await connection.beginTransaction();

    await connection.query(
      `INSERT INTO org_postings
         (id, tenant_id, title, type, department, total_seats, application_fee,
          start_date, end_date, test_date, status, applications_received)
       VALUES (?, ?, ?, 'entry_test', ?, 20, 0, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 90 DAY),
               DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'active', 20)
       ON DUPLICATE KEY UPDATE
         title = VALUES(title), department = VALUES(department), total_seats = VALUES(total_seats),
         end_date = VALUES(end_date), test_date = VALUES(test_date), status = 'active',
         applications_received = VALUES(applications_received), deleted_at = NULL`,
      [POSTING_ID, tenant.id, '1BILL UAT Certification Cases', 'Integration Testing']
    );

    const now = new Date();
    const createdAt = mysqlDateTime(now);
    const expiryDate = '2099-12-31 23:59:59';

    for (let index = 0; index < cases.length; index += 1) {
      const testCase = cases[index];
      const id = crypto.randomUUID();
      const applicationId = `1BILL-UAT-${String(index + 1).padStart(2, '0')}-${testCase.key}`;
      const applicantId = `UAT-APPLICANT-${String(index + 1).padStart(3, '0')}`;
      const billId = `ORG-UAT-${String(index + 1).padStart(3, '0')}`;
      const dueDate = mysqlDate(addDays(now, testCase.dueOffsetDays));
      const paidAt = testCase.status === 'paid' ? createdAt : null;
      const description = `UAT ${testCase.category} ${String(index + 1).padStart(2, '0')}`;

      await connection.query(
        `INSERT INTO org_payment_records
           (id, tenant_id, application_id, applicant_id, posting_id, bill_id,
            consumer_number, amount, status, due_date, expiry_date, created_at,
            paid_at, transaction_id, description, callback_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           applicant_id = VALUES(applicant_id), posting_id = VALUES(posting_id),
           bill_id = VALUES(bill_id), consumer_number = VALUES(consumer_number),
           amount = VALUES(amount), status = VALUES(status), due_date = VALUES(due_date),
           expiry_date = VALUES(expiry_date), paid_at = VALUES(paid_at),
           transaction_id = VALUES(transaction_id), description = VALUES(description),
           callback_url = VALUES(callback_url)`,
        [
          id,
          tenant.id,
          applicationId,
          applicantId,
          POSTING_ID,
          billId,
          testCase.consumerNumber,
          testCase.amount,
          testCase.status,
          dueDate,
          expiryDate,
          createdAt,
          paidAt,
          testCase.transactionId || null,
          description,
          config.org.callbackUrl,
        ]
      );

      const [[payment]] = await connection.query(
        'SELECT id FROM org_payment_records WHERE application_id = ? AND tenant_id = ?',
        [applicationId, tenant.id]
      );
      await connection.query('DELETE FROM org_payment_notifications WHERE payment_id = ?', [payment.id]);
      await connection.query(
        `INSERT INTO org_payment_notifications
           (id, tenant_id, application_id, payment_id, bill_id, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), tenant.id, applicationId, payment.id, billId, testCase.status]
      );

      Object.assign(testCase, { applicationId, billId, dueDate });
    }

    await connection.query(
      'UPDATE tenants SET next_consumer_sequence = GREATEST(next_consumer_sequence, 21) WHERE id = ?',
      [tenant.id]
    );

    await connection.commit();
    connection.release();
    connectionReleased = true;

    const results = [];
    for (const testCase of cases) {
      const response = await fetch('http://127.0.0.1:3000/api/1.0/Payments/BillInquiry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-Proto': 'https',
          'X-Forwarded-For': '10.95.8.92',
          username: config.onebill.username,
          password: config.onebill.password,
        },
        body: JSON.stringify({
          consumer_number: testCase.consumerNumber,
          bank_mnemonic: 'UBL',
          reserved: '',
        }),
      });
      const body = await response.json();
      const passed = response.status === 200
        && body.response_Code === testCase.expectedCode
        && body.bill_status === testCase.expectedBillStatus;
      results.push({ ...testCase, httpStatus: response.status, actualCode: body.response_Code, actualBillStatus: body.bill_status, passed });
    }

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true, mode: 0o700 });
    const headers = [
      'case', 'category', 'consumer_number', 'digits', 'amount_pkr', 'database_status',
      'due_date', 'expected_response_code', 'expected_bill_status', 'actual_response_code',
      'actual_bill_status', 'verification', 'application_id', 'bill_id',
    ];
    const lines = [headers.join(',')];
    for (const result of results) {
      lines.push([
        result.key,
        result.category,
        result.consumerNumber,
        result.consumerNumber.length,
        result.amount.toFixed(2),
        result.status,
        result.dueDate,
        result.expectedCode,
        result.expectedBillStatus,
        result.actualCode,
        result.actualBillStatus,
        result.passed ? 'PASS' : 'FAIL',
        result.applicationId,
        result.billId,
      ].map(csvEscape).join(','));
    }
    fs.writeFileSync(OUTPUT_PATH, `${lines.join('\n')}\n`, { mode: 0o600 });

    console.log(`TENANT=${tenant.name}`);
    console.log(`CREATED_OR_UPDATED=${results.length}`);
    console.log(`VERIFIED_PASS=${results.filter((result) => result.passed).length}`);
    console.log(`VERIFIED_FAIL=${results.filter((result) => !result.passed).length}`);
    console.log(`CSV=${OUTPUT_PATH}`);
    for (const result of results) {
      console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.key} ${result.consumerNumber} code=${result.actualCode} status=${result.actualBillStatus}`);
    }

    if (results.some((result) => !result.passed)) process.exitCode = 1;
  } catch (error) {
    if (!connectionReleased) {
      try { await connection.rollback(); } catch { /* keep the original failure */ }
      connection.release();
    }
    throw error;
  }
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
