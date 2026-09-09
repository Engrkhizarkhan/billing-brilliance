const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/index');
const { pool } = require('../src/config/database');

afterAll(async () => pool.end());

describe('current public API contracts', () => {
  test('health endpoint is available', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', service: 'fintap-api' });
  });

  test('1LINK rejects invalid credentials using the specified envelope', async () => {
    const response = await request(app)
      .post('/api/1.0/Payments/BillInquiry')
      .set('username', 'invalid')
      .set('password', 'invalid')
      .send({});
    expect(response.status).toBe(401);
    expect(response.body.response_Code).toBe('04');
    expect(response.body.bill_status).toBe('B');
  });
});

const databaseDescribe = process.env.RUN_DB_INTEGRATION === 'true' ? describe : describe.skip;

databaseDescribe('disposable-database authenticated workflows', () => {
  let token;

  beforeAll(async () => {
    if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD) {
      throw new Error('Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD for database integration tests');
    }
    const response = await request(app).post('/api/auth/login').send({
      email: process.env.TEST_ADMIN_EMAIL,
      password: process.env.TEST_ADMIN_PASSWORD,
    });
    expect(response.status).toBe(200);
    token = response.body.data.token;
  });

  test('returns the authenticated profile without password or API-key secrets', async () => {
    const response = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data.password_hash).toBeUndefined();
    expect(response.body.data.api_key).toBeUndefined();
  });

  test('paginates the biller administration list', async () => {
    const response = await request(app).get('/api/tenants?page=1&pageSize=25').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.meta.pageSize).toBe(25);
  });

  test('lets a platform admin inspect a consumer in card and 1BILL response formats', async () => {
    const [[consumer]] = await pool.query(
      `SELECT consumer_number FROM students
       WHERE status = 'active' AND deleted_at IS NULL ORDER BY created_at LIMIT 1`
    );
    expect(consumer?.consumer_number).toBeTruthy();

    const response = await request(app)
      .post('/api/manual-payments/inquiry')
      .set('Authorization', `Bearer ${token}`)
      .send({ consumerNumber: consumer.consumer_number });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      found: true,
      targetType: 'invoice',
      consumerNumber: consumer.consumer_number,
      currency: 'PKR',
    });
    expect(response.body.data.tenantId).toBeTruthy();
    expect(response.body.data.oneBillResponse).toEqual(expect.objectContaining({
      response_Code: '00',
      bill_status: expect.stringMatching(/^[UP]$/),
      reserved: '',
    }));
  });

  test('rejects malformed admin consumer inquiries', async () => {
    const response = await request(app)
      .post('/api/manual-payments/inquiry')
      .set('Authorization', `Bearer ${token}`)
      .send({ consumerNumber: '105172-INVALID' });
    expect(response.status).toBe(400);
  });

  test('admin verification posts complete accounting and audit evidence', async () => {
    const suffix = String(Date.now()).slice(-8);
    const tenantId = crypto.randomUUID();
    const studentId = crypto.randomUUID();
    const invoiceId = crypto.randomUUID();
    const billerCode = `9${suffix.slice(-3)}`;
    const consumerNumber = `105172${billerCode}${suffix.padStart(14, '0')}`;
    const billId = `ADMIN-QA-${suffix}`;
    const externalReference = `ADMIN-VERIFY-${suffix}`;
    let paymentId;

    try {
      await pool.query(
        `INSERT INTO tenants
         (id, name, type, biller_code, email, status, lifecycle_stage, consumer_number_length)
         VALUES (?, 'Admin Verification QA', 'school', ?, ?, 'active', 'live', 24)`,
        [tenantId, billerCode, `admin-qa-${suffix}@example.test`]
      );
      await pool.query(
        `INSERT INTO students
         (id, tenant_id, name, father_name, class, consumer_number, bill_id, status, gender)
         VALUES (?, ?, 'Verification Student', 'Verification Parent', 'QA', ?, ?, 'active', 'male')`,
        [studentId, tenantId, consumerNumber, billId]
      );
      await pool.query(
        `INSERT INTO invoices
         (id, tenant_id, invoice_number, student_id, student_name, consumer_number, amount, status, due_date)
         VALUES (?, ?, ?, ?, 'Verification Student', ?, 1234.56, 'pending', DATE_ADD(CURDATE(), INTERVAL 7 DAY))`,
        [invoiceId, tenantId, `INV-${billId}`, studentId, consumerNumber]
      );

      const inquiry = await request(app)
        .post('/api/manual-payments/inquiry')
        .set('Authorization', `Bearer ${token}`)
        .send({ consumerNumber });
      expect(inquiry.status).toBe(200);
      expect(inquiry.body.data).toMatchObject({ payable: true, amount: 1234.56, tenantId });

      const payment = await request(app)
        .post('/api/manual-payments/record')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-Id', tenantId)
        .set('X-Idempotency-Key', externalReference)
        .send({
          tenantId,
          targetType: 'invoice',
          consumerNumber,
          amount: 1234.56,
          receivedAt: new Date().toISOString(),
          channel: 'counter',
          externalReference,
          reason: 'Verified by automated admin acceptance test',
          idempotencyKey: externalReference,
        });
      expect(payment.status).toBe(201);
      paymentId = payment.body.data.paymentId;

      const [[evidence]] = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM payments WHERE id = ? AND status = 'posted') AS payments,
           (SELECT COUNT(*) FROM payment_allocations WHERE payment_id = ? AND target_type = 'invoice' AND target_id = ?) AS allocations,
           (SELECT COUNT(*) FROM transactions WHERE tenant_id = ? AND reference = ? AND status = 'completed') AS transactions,
           (SELECT COUNT(*) FROM ledger_entries WHERE tenant_id = ? AND reference = ? AND entry_type = 'payment') AS ledger_entries,
           (SELECT COUNT(*) FROM audit_logs WHERE tenant_id = ? AND entity_id = ? AND action = 'payment') AS audit_entries,
           (SELECT COUNT(*) FROM outbox_events WHERE tenant_id = ? AND aggregate_id = ? AND event_type = 'payment.posted') AS outbox_events`,
        [paymentId, paymentId, invoiceId, tenantId, externalReference, tenantId, externalReference,
          tenantId, paymentId, tenantId, paymentId]
      );
      expect(evidence).toEqual(expect.objectContaining({
        payments: 1, allocations: 1, transactions: 1,
        ledger_entries: 1, audit_entries: 1, outbox_events: 1,
      }));

      const refreshed = await request(app)
        .post('/api/manual-payments/inquiry')
        .set('Authorization', `Bearer ${token}`)
        .send({ consumerNumber });
      expect(refreshed.body.data.payable).toBe(false);
      expect(refreshed.body.data.oneBillResponse.bill_status).toBe('P');
    } finally {
      await pool.query('DELETE FROM notifications WHERE tenant_id = ?', [tenantId]);
      await pool.query('DELETE FROM outbox_events WHERE tenant_id = ?', [tenantId]);
      await pool.query('DELETE FROM audit_logs WHERE tenant_id = ?', [tenantId]);
      await pool.query('DELETE FROM ledger_entries WHERE tenant_id = ?', [tenantId]);
      await pool.query('DELETE FROM transactions WHERE tenant_id = ?', [tenantId]);
      await pool.query('DELETE FROM payment_allocations WHERE tenant_id = ?', [tenantId]);
      await pool.query('DELETE FROM payments WHERE tenant_id = ?', [tenantId]);
      await pool.query('DELETE FROM invoices WHERE tenant_id = ?', [tenantId]);
      await pool.query('DELETE FROM students WHERE tenant_id = ?', [tenantId]);
      await pool.query('DELETE FROM tenants WHERE id = ?', [tenantId]);
    }
  });
});
