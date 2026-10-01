const request = require('supertest');
const app = require('../../src/index');
const config = require('../../src/config');
const { pool } = require('../../src/config/database');

afterAll(async () => {
  await pool.end();
});

describe('public service contracts', () => {
  test('BillInquiry authentication failure preserves provider casing and space widths', async () => {
    const response = await request(app).post('/api/1.0/Payments/BillInquiry')
      .set('username', 'wrong').set('password', 'wrong').send({});
    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      response_Code:'04',consumer_Detail:' '.repeat(30),bill_status:'B',due_date:' '.repeat(8),
      amount_within_dueDate:'+0000000000000',amount_after_dueDate:'+0000000000000',
      billing_month:' '.repeat(4),date_paid:' '.repeat(8),amount_paid:' '.repeat(12),tran_auth_Id:' '.repeat(6),reserved:'',
    });
  });
  test('liveness is available without authentication', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.environment).toBe(config.appEnvironment);
  });

  test('BillPayment authentication failure uses the payment response shape', async () => {
    const response = await request(app)
      .post('/api/1.0/Payments/BillPayment')
      .set('username', 'wrong')
      .set('password', 'wrong')
      .send({});

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      response_Code: '04',
      reserved: '',
      identification_parameter: '',
    });
  });
});
