const request = require('supertest');
const app = require('../../src/index');
const { pool } = require('../../src/config/database');

afterAll(async () => {
  await pool.end();
});

describe('public service contracts', () => {
  test('liveness is available without authentication', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
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
      Identification_parameter: '',
      reserved: '',
    });
  });
});
