jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../src/services/paymentPostingService', () => ({ postPayment: jest.fn() }));

const { pool } = require('../../src/config/database');
const { postPayment } = require('../../src/services/paymentPostingService');
const { billInquiry1Link, billPayment1Link } = require('../../src/controllers/oneLinkController');

const response = () => ({ json: jest.fn(function json(body) { this.body = body; return this; }) });

describe('1LINK invoice contract', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns a paid student with a six-digit authorization ID', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 'student-1', tenant_id: 'tenant-1', name: 'Test Student', status: 'active' }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ debit: '0.00', credit: '0.00' }]])
      .mockResolvedValueOnce([[{ amount: '5000.00', received_at: '2026-09-08 10:00:00', transaction_id: '123456' }]]);
    const res = response();

    await billInquiry1Link({ body: { consumer_number: '10517210010001', bank_mnemonic: 'UBL00001', reserved: '' } }, res);

    expect(res.body).toMatchObject({ response_Code: '00', bill_status: 'P', tran_auth_Id: '123456', amount_paid: '000000500000' });
    expect(pool.query.mock.calls[3][0]).toContain('voucher_number AS transaction_id');
  });

  test('posts the exact 1LINK amount and preserves the four-field duplicate key', async () => {
    pool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{
        tenant_id: 'tenant-1', target_id: null, target_type: 'invoice', detail: 'Test Student',
      }]]);
    postPayment.mockResolvedValueOnce({ consumerNumber: '10517210010001' });
    const res = response();
    await billPayment1Link({
      body: {
        consumer_number: '10517210010001', tran_auth_id: '123456', transaction_amount: '000000500000',
        tran_date: '20260908', tran_time: '101112', bank_mnemonic: 'UBL00001', reserved: '',
      },
      ip: '10.95.8.92', headers: {},
    }, res);

    expect(postPayment).toHaveBeenCalledWith(expect.objectContaining({
      amount: 5000,
      transactionId: '123456',
      idempotencyKey: '10517210010001:123456:20260908:101112',
      source: 'onelink',
    }));
    expect(res.body).toEqual({ response_Code: '00', Identification_parameter: 'Test Student', reserved: '' });
  });

  test('maps a duplicate payment to response code 03', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 'existing-payment' }]]);
    const res = response();
    await billPayment1Link({
      body: {
        consumer_number: '10517210010001', tran_auth_id: '123456', transaction_amount: '000000500000',
        tran_date: '20260908', tran_time: '101112', bank_mnemonic: 'UBL00001', reserved: '',
      },
      ip: '10.95.8.92', headers: {},
    }, res);

    expect(res.body.response_Code).toBe('03');
    expect(postPayment).not.toHaveBeenCalled();
  });
});
