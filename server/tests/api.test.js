const request = require('supertest');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const app = require('../src/index');
const { pool } = require('../src/config/database');
const config = require('../src/config');

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

  test('lists issued consumer numbers across tenants with server-side filters', async () => {
    const response = await request(app)
      .get('/api/admin/consumers?page=1&pageSize=25&sourceType=school_student&consumerLength=24&archiveState=current')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual(expect.objectContaining({ page: 1, pageSize: 25 }));
    expect(response.body.meta.bySource).toEqual(expect.objectContaining({
      schoolStudent: expect.any(Number),
      organizationApplicant: 0,
      paymentRequest: 0,
    }));
    expect(Array.isArray(response.body.meta.tenants)).toBe(true);
    expect(response.body.data.length).toBeLessThanOrEqual(25);
    for (const record of response.body.data) {
      expect(record.source_type).toBe('school_student');
      expect(record.consumer_number).toMatch(/^\d{24}$/);
      expect(record.tenant_id).toBeTruthy();
      expect(record.tenant_name).toBeTruthy();
    }

    if (response.body.data[0]) {
      const consumerNumber = response.body.data[0].consumer_number;
      const exactSearch = await request(app)
        .get(`/api/admin/consumers?search=${encodeURIComponent(consumerNumber)}&pageSize=10`)
        .set('Authorization', `Bearer ${token}`);
      expect(exactSearch.status).toBe(200);
      expect(exactSearch.body.data.some((item) => item.consumer_number === consumerNumber)).toBe(true);
    }

    const [[schoolUser]] = await pool.query(
      `SELECT u.id, u.email, u.role, u.tenant_id, u.school_ref, u.school_access_role
       FROM users u INNER JOIN tenants t ON t.id = u.tenant_id
       WHERE u.role = 'school' AND u.status = 'active' AND u.deleted_at IS NULL
         AND t.status = 'active' AND t.deleted_at IS NULL LIMIT 1`
    );
    expect(schoolUser).toBeTruthy();
    const schoolToken = jwt.sign({
      userId: schoolUser.id,
      email: schoolUser.email,
      role: schoolUser.role,
      tenantId: schoolUser.tenant_id,
      schoolRef: schoolUser.school_ref,
      schoolAccessRole: schoolUser.school_access_role,
    }, config.jwt.secret, { expiresIn: '5m' });
    const forbidden = await request(app).get('/api/admin/consumers')
      .set('Authorization', `Bearer ${schoolToken}`);
    expect(forbidden.status).toBe(403);
  });

  test('keeps school and organization lists server-paginated beyond 2,000 records', async () => {
    const suffix = String(Date.now()).slice(-8);
    const codeTail = String(crypto.randomInt(0, 1000)).padStart(3, '0');
    const schoolTenantId = crypto.randomUUID();
    const orgTenantId = crypto.randomUUID();
    const rowCount = 2105;
    const insertChunks = async (sql, rows, size = 250) => {
      for (let offset = 0; offset < rows.length; offset += size) {
        await pool.query(sql, [rows.slice(offset, offset + size)]);
      }
    };

    try {
      await pool.query(
        `INSERT INTO tenants
         (id, name, type, biller_code, email, status, lifecycle_stage, consumer_number_length)
         VALUES (?, 'School Capacity QA', 'school', ?, ?, 'active', 'live', 24),
                (?, 'Organization Capacity QA', 'org', ?, ?, 'active', 'live', 24)`,
        [
          schoolTenantId, `6${codeTail}`, `school-capacity-${suffix}@example.test`,
          orgTenantId, `7${codeTail}`, `org-capacity-${suffix}@example.test`,
        ]
      );

      const studentRows = Array.from({ length: rowCount }, (_, index) => {
        const sequence = String(index + 1).padStart(14, '0');
        return [
          crypto.randomUUID(), schoolTenantId, `Capacity Student ${index + 1}`,
          'Capacity Parent', String((index % 12) + 1), `S-${index % 4}`,
          `1051726${codeTail}${sequence}`, `CAP-STU-${suffix}-${index + 1}`,
          index + 1, 'active', index % 2 === 0 ? 'male' : 'female',
        ];
      });
      await insertChunks(
        `INSERT INTO students
         (id, tenant_id, name, father_name, class, section, consumer_number, bill_id, seq_number, status, gender)
         VALUES ?`,
        studentRows
      );

      const orgRows = Array.from({ length: rowCount }, (_, index) => {
        const sequence = String(index + 1).padStart(14, '0');
        return [
          crypto.randomUUID(), orgTenantId, `CAP-APP-${suffix}-${index + 1}`,
          crypto.randomUUID(), `Capacity Customer ${index + 1}`, crypto.randomUUID(),
          `CAP-BILL-${suffix}-${index + 1}`, `1051727${codeTail}${sequence}`,
          1000 + index, 'pending', '2026-12-01', '2026-12-02 23:59:59',
          'Capacity pagination record',
        ];
      });
      await insertChunks(
        `INSERT INTO org_payment_records
         (id, tenant_id, application_id, applicant_id, customer_name, posting_id, bill_id,
          consumer_number, amount, status, due_date, expiry_date, description)
         VALUES ?`,
        orgRows
      );

      const schoolStarted = Date.now();
      const schoolPage = await request(app).get('/api/students?page=1&pageSize=25')
        .set('Authorization', `Bearer ${token}`).set('X-Tenant-Id', schoolTenantId);
      const schoolElapsedMs = Date.now() - schoolStarted;
      expect(schoolPage.status).toBe(200);
      expect(schoolPage.body.data).toHaveLength(25);
      expect(schoolPage.body.meta.total).toBe(rowCount);
      expect(schoolElapsedMs).toBeLessThan(8000);

      const orgStarted = Date.now();
      const orgPage = await request(app).get('/api/payments?page=1&limit=30')
        .set('Authorization', `Bearer ${token}`).set('X-Tenant-Id', orgTenantId);
      const orgElapsedMs = Date.now() - orgStarted;
      expect(orgPage.status).toBe(200);
      expect(orgPage.body.data).toHaveLength(30);
      expect(orgPage.body.meta).toMatchObject({ total: rowCount, pageSize: 30, pages: 71 });
      expect(orgElapsedMs).toBeLessThan(8000);

      const lastOrgPage = await request(app).get('/api/payments?page=71&limit=30')
        .set('Authorization', `Bearer ${token}`).set('X-Tenant-Id', orgTenantId);
      expect(lastOrgPage.status).toBe(200);
      expect(lastOrgPage.body.data).toHaveLength(5);

      const registryStarted = Date.now();
      const registryPage = await request(app)
        .get(`/api/admin/consumers?tenantId=${schoolTenantId}&sourceType=school_student&page=1&pageSize=100`)
        .set('Authorization', `Bearer ${token}`);
      const registryElapsedMs = Date.now() - registryStarted;
      expect(registryPage.status).toBe(200);
      expect(registryPage.body.data).toHaveLength(100);
      expect(registryPage.body.meta).toMatchObject({ total: rowCount, pageSize: 100, pages: 22 });
      expect(registryElapsedMs).toBeLessThan(8000);
    } finally {
      await pool.query('DELETE FROM org_payment_records WHERE tenant_id = ?', [orgTenantId]);
      await pool.query('DELETE FROM students WHERE tenant_id = ?', [schoolTenantId]);
      await pool.query('DELETE FROM tenants WHERE id IN (?, ?)', [schoolTenantId, orgTenantId]);
    }
  }, 30000);

  test('protects recoverable API keys with the administrator PIN', async () => {
    const suffix = String(Date.now()).slice(-8);
    let tenantId;
    try {
      const created = await request(app).post('/api/tenants')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Key QA ${suffix}`, type: 'org', email: `key-${suffix}@example.test`, phone: '03000000000', consumerNumberLength: 24 });
      expect(created.status).toBe(201);
      tenantId = created.body.data.id;
      const originalKey = created.body.data.api_key;
      expect(originalKey).toMatch(/^fintap_(live|test)_/);

      const denied = await request(app).post(`/api/tenants/${tenantId}/reveal-api-key`)
        .set('Authorization', `Bearer ${token}`).send({ pin: '000000' });
      expect(denied.status).toBe(403);
      expect(denied.body.code).toBe('INVALID_ADMIN_PIN');

      const revealed = await request(app).post(`/api/tenants/${tenantId}/reveal-api-key`)
        .set('Authorization', `Bearer ${token}`).send({ pin: require('../src/config').admin.actionPin });
      expect(revealed.status).toBe(200);
      expect(revealed.body.data.apiKey).toBe(originalKey);
      expect(JSON.stringify(revealed.body)).not.toContain('api_key_hash');
    } finally {
      if (tenantId) {
        await pool.query('DELETE FROM audit_logs WHERE entity_id = ? OR tenant_id = ?', [tenantId, tenantId]);
        await pool.query('DELETE FROM tenants WHERE id = ?', [tenantId]);
      }
    }
  });

  test('blocks production payment creation while testing and enforces customer name/never-expiry when live', async () => {
    const suffix = String(Date.now()).slice(-8);
    const tenantId = crypto.randomUUID();
    const billerCode = `8${suffix.slice(-3)}`;
    try {
      await pool.query(
        `INSERT INTO tenants (id, name, type, biller_code, email, status, lifecycle_stage, consumer_number_length)
         VALUES (?, 'Lifecycle QA', 'org', ?, ?, 'active', 'testing', 24)`,
        [tenantId, billerCode, `lifecycle-${suffix}@example.test`]
      );
      const baseRequest = { applicant_id: `AP-${suffix}`, application_id: `APP-${suffix}`, posting_id: `POST-${suffix}`, amount: 2500, description: 'Lifecycle QA' };
      const blocked = await request(app).post('/api/payments/create')
        .set('Authorization', `Bearer ${token}`).set('X-Tenant-Id', tenantId)
        .set('X-Forwarded-Proto', 'https')
        .send({ ...baseRequest, customer_name: 'Lifecycle Customer' });
      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe('TENANT_NOT_LIVE');

      await pool.query("UPDATE tenants SET lifecycle_stage = 'live' WHERE id = ?", [tenantId]);
      const missingName = await request(app).post('/api/payments/create')
        .set('Authorization', `Bearer ${token}`).set('X-Tenant-Id', tenantId)
        .set('X-Forwarded-Proto', 'https').send(baseRequest);
      expect(missingName.status).toBe(400);

      const created = await request(app).post('/api/payments/create')
        .set('Authorization', `Bearer ${token}`).set('X-Tenant-Id', tenantId)
        .set('X-Forwarded-Proto', 'https')
        .send({ ...baseRequest, customer_name: 'Lifecycle Customer', never_expires: true, expire_at: '2026-09-11T00:00:00.000Z' });
      expect(created.status).toBe(201);
      expect(created.body.data.oneBillRequest).toMatchObject({ customerName: 'Lifecycle Customer', neverExpires: true, expires: 'never' });
      const [[stored]] = await pool.query('SELECT customer_name, YEAR(expiry_date) AS expiry_year FROM org_payment_records WHERE tenant_id = ?', [tenantId]);
      expect(stored.customer_name).toBe('Lifecycle Customer');
      expect(Number(stored.expiry_year)).toBe(9999);
    } finally {
      await pool.query('DELETE FROM org_payment_notifications WHERE tenant_id = ?', [tenantId]);
      await pool.query('DELETE FROM audit_logs WHERE tenant_id = ?', [tenantId]);
      await pool.query('DELETE FROM org_payment_records WHERE tenant_id = ?', [tenantId]);
      await pool.query('DELETE FROM tenants WHERE id = ?', [tenantId]);
    }
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
