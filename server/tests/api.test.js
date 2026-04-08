const request = require('supertest');
const app = require('../src/index');
const { pool } = require('../src/config/database');

// Helpers
let adminToken;
let schoolToken;
let eteaToken;

const loginAs = async (email, password, role) => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password, role });
  return res.body.data?.token;
};

beforeAll(async () => {
  // Wait for DB connection
  await new Promise((resolve) => setTimeout(resolve, 1000));

  adminToken = await loginAs('admin@example.com', '123456', 'admin');
  schoolToken = await loginAs('school@example.com', '123456', 'school');
  eteaToken = await loginAs('etea@example.com', '123456', 'etea');
});

afterAll(async () => {
  await pool.end();
});

// ============================================================
// AUTH TESTS
// ============================================================
describe('Auth Endpoints', () => {
  test('POST /api/auth/login - valid admin login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: '123456', role: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data).toHaveProperty('user');
    expect(res.body.data.user.role).toBe('admin');
  });

  test('POST /api/auth/login - wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'wrongpass', role: 'admin' });

    expect(res.status).toBe(401);
  });

  test('POST /api/auth/login - role mismatch', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: '123456', role: 'school' });

    expect(res.status).toBe(401);
  });

  test('POST /api/auth/login - inactive user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jane@agency.com', password: '123456', role: 'etea' });

    expect(res.status).toBe(403);
  });

  test('GET /api/auth/profile - with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('admin@example.com');
  });

  test('GET /api/auth/profile - without token', async () => {
    const res = await request(app).get('/api/auth/profile');
    expect(res.status).toBe(401);
  });
});

// ============================================================
// USER TESTS
// ============================================================
describe('User Endpoints', () => {
  test('GET /api/users - admin can list users', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toHaveProperty('total');
  });

  test('GET /api/users - with pagination', async () => {
    const res = await request(app)
      .get('/api/users?page=1&pageSize=2')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.meta.pageSize).toBe(2);
  });

  test('GET /api/users - filter by role', async () => {
    const res = await request(app)
      .get('/api/users?role=school')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.data.forEach(user => {
      expect(user.role).toBe('school');
    });
  });
});

// ============================================================
// TENANT TESTS
// ============================================================
describe('Tenant Endpoints', () => {
  test('GET /api/tenants - admin can list tenants', async () => {
    const res = await request(app)
      .get('/api/tenants')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/tenants - non-admin rejected', async () => {
    const res = await request(app)
      .get('/api/tenants')
      .set('Authorization', `Bearer ${schoolToken}`);

    expect(res.status).toBe(403);
  });
});

// ============================================================
// STUDENT TESTS
// ============================================================
describe('Student Endpoints', () => {
  test('GET /api/students - list students', async () => {
    const res = await request(app)
      .get('/api/students')
      .set('Authorization', `Bearer ${schoolToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/students - search filter', async () => {
    const res = await request(app)
      .get('/api/students?search=Ahmed')
      .set('Authorization', `Bearer ${schoolToken}`);

    expect(res.status).toBe(200);
  });

  test('GET /api/students/:id - get specific student', async () => {
    // First get a student ID
    const listRes = await request(app)
      .get('/api/students?pageSize=1')
      .set('Authorization', `Bearer ${schoolToken}`);

    if (listRes.body.data.length > 0) {
      const studentId = listRes.body.data[0].id;
      const res = await request(app)
        .get(`/api/students/${studentId}`)
        .set('Authorization', `Bearer ${schoolToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(studentId);
    }
  });

  test('GET /api/students/:id/snapshot - financial snapshot', async () => {
    const listRes = await request(app)
      .get('/api/students?pageSize=1')
      .set('Authorization', `Bearer ${schoolToken}`);

    if (listRes.body.data.length > 0) {
      const studentId = listRes.body.data[0].id;
      const res = await request(app)
        .get(`/api/students/${studentId}/snapshot`)
        .set('Authorization', `Bearer ${schoolToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('riskTier');
      expect(res.body.data).toHaveProperty('totalDue');
    }
  });
});

// ============================================================
// INVOICE TESTS
// ============================================================
describe('Invoice Endpoints', () => {
  test('GET /api/invoices - list invoices', async () => {
    const res = await request(app)
      .get('/api/invoices')
      .set('Authorization', `Bearer ${schoolToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/invoices - filter by status', async () => {
    const res = await request(app)
      .get('/api/invoices?status=pending')
      .set('Authorization', `Bearer ${schoolToken}`);

    expect(res.status).toBe(200);
  });
});

// ============================================================
// BILLING / 1LINK TESTS
// ============================================================
describe('Billing (1LINK) Endpoints', () => {
  test('POST /api/billing/inquiry - bill inquiry', async () => {
    // Get a valid consumer number from students
    const studentsRes = await request(app)
      .get('/api/students?pageSize=1')
      .set('Authorization', `Bearer ${schoolToken}`);

    if (studentsRes.body.data.length > 0) {
      const consumerNumber = studentsRes.body.data[0].consumer_number;
      const res = await request(app)
        .post('/api/billing/inquiry')
        .set('X-API-Key', 'change-me-in-production')
        .send({ consumerNumber });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('found');
    }
  });

  test('POST /api/billing/inquiry - not found', async () => {
    const res = await request(app)
      .post('/api/billing/inquiry')
      .set('X-API-Key', 'change-me-in-production')
      .send({ consumerNumber: '000000000000000000000000' });

    expect(res.status).toBe(200);
    expect(res.body.data.found).toBe(false);
  });
});

// ============================================================
// ETEA PAYMENT TESTS
// ============================================================
describe('ETEA Payment Endpoints', () => {
  test('GET /api/health - health check', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ============================================================
// SETTINGS TESTS
// ============================================================
describe('Settings Endpoints', () => {
  test('GET /api/fee-plans - list fee plans', async () => {
    const res = await request(app)
      .get('/api/fee-plans')
      .set('Authorization', `Bearer ${schoolToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/scholarships - list scholarships', async () => {
    const res = await request(app)
      .get('/api/scholarships')
      .set('Authorization', `Bearer ${schoolToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ============================================================
// REPORTS TESTS
// ============================================================
describe('Report Endpoints', () => {
  test('GET /api/reports/dashboard - school dashboard stats', async () => {
    const res = await request(app)
      .get('/api/reports/dashboard')
      .set('Authorization', `Bearer ${schoolToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('totalStudents');
    expect(res.body.data).toHaveProperty('paidRevenue');
  });

  test('GET /api/reports/platform-summary - admin only', async () => {
    const res = await request(app)
      .get('/api/reports/platform-summary')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('totalTenants');
  });

  test('GET /api/reports/platform-summary - non-admin rejected', async () => {
    const res = await request(app)
      .get('/api/reports/platform-summary')
      .set('Authorization', `Bearer ${schoolToken}`);

    expect(res.status).toBe(403);
  });
});

// ============================================================
// NOTIFICATION TESTS
// ============================================================
describe('Notification Endpoints', () => {
  test('GET /api/notifications - list notifications', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ============================================================
// AUDIT LOG TESTS
// ============================================================
describe('Audit Log Endpoints', () => {
  test('GET /api/audit-logs - admin can view audit logs', async () => {
    const res = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
