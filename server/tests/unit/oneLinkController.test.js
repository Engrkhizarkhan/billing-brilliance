jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../src/services/paymentPostingService', () => ({ postPayment: jest.fn() }));
jest.mock('../../src/services/oneBillConsumerService', () => ({ resolveOneBillConsumer: jest.fn(async (number) => number) }));

const { pool } = require('../../src/config/database');
const { postPayment } = require('../../src/services/paymentPostingService');
const { resolveOneBillConsumer } = require('../../src/services/oneBillConsumerService');
const { billInquiry1Link, billPayment1Link } = require('../../src/controllers/oneLinkController');

const response = () => ({ json: jest.fn(function json(body) { this.body = body; return this; }) });

describe('1LINK invoice contract', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns a paid student with a six-digit authorization ID', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 'student-1', tenant_id: 'tenant-1', name: 'Test Student', status: 'active' }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ debit: '0.00', credit: '0.00' }]])
      .mockResolvedValueOnce([[{ amount: '5000.00', received_at: '2026-09-08 10:00:00', transaction_id: '123456' }]])
      .mockResolvedValueOnce([[{ due_date: '2026-10-05', month: '2026-09' }]]);
    const res = response();

    await billInquiry1Link({ body: { consumer_number: '10517210010001', bank_mnemonic: 'UBL00001', reserved: '' } }, res);

    expect(res.body).toMatchObject({
      response_Code: '06', bill_status: 'P', due_date: '20261005', billing_month: '2609',
      consumer_Detail: 'Test Student'.padEnd(30, ' '),
      tran_auth_Id: '123456', amount_paid: '000000500000',
    });
    expect(pool.query.mock.calls[3][0]).toContain('voucher_number AS transaction_id');
  });

  test('uses the billed month rather than the following-month due date', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 'student-1', tenant_id: 'tenant-1', name: 'Test Student', status: 'active' }]])
      .mockResolvedValueOnce([[
        { id: 'invoice-1', amount: '2500.00', due_date: '2026-10-05', month: '2026-09', late_fee: '0', late_fee_applied: 0 },
      ]])
      .mockResolvedValueOnce([[{ debit: '2500.00', credit: '0.00' }]]);
    const res = response();

    await billInquiry1Link({ body: { consumer_number: '10517210010001', bank_mnemonic: 'UBL00001', reserved: '' } }, res);

    expect(res.body).toEqual({
      response_Code: '00', consumer_Detail: 'Test Student'.padEnd(30, ' '),
      bill_status: 'U', due_date: '20261005', billing_month: '2609',
      amount_within_dueDate: '+0000000250000', amount_after_dueDate: '+0000000250000',
      date_paid: ' '.repeat(8), amount_paid: ' '.repeat(12), tran_auth_Id: ' '.repeat(6), reserved: '',
    });
  });

  test.each(['missing', 'blocked', 'invalid', 'failure'])('pads every absent field in %s inquiries', async (scenario) => {
    if (scenario === 'missing') pool.query.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);
    if (scenario === 'blocked') pool.query.mockResolvedValueOnce([[{ status: 'inactive' }]]);
    if (scenario === 'failure') pool.query.mockRejectedValueOnce(new Error('Database unavailable'));
    const res = response();
    await billInquiry1Link({body:{consumer_number:'10517210010001',bank_mnemonic:scenario === 'invalid' ? '' : 'MDL'}},res);
    expect(res.body).toEqual({
      response_Code: {missing:'01',blocked:'02',invalid:'04',failure:'03'}[scenario],
      consumer_Detail:' '.repeat(30),bill_status:scenario === 'blocked' ? 'B' : ' ',due_date:' '.repeat(8),
      amount_within_dueDate:'+0000000000000',amount_after_dueDate:'+0000000000000',
      billing_month:' '.repeat(4),date_paid:' '.repeat(8),amount_paid:' '.repeat(12),
      tran_auth_Id:' '.repeat(6),reserved:'',
    });
  });

  test('unbilled consumer is unavailable, never falsely reported as paid', async () => {
    pool.query
      .mockResolvedValueOnce([[{id:'student-1',tenant_id:'tenant-1',name:'Test',status:'active'}]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{debit:0,credit:0}]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);
    const res=response();
    await billInquiry1Link({body:{consumer_number:'10517210010001',bank_mnemonic:'MDL'}},res);
    expect(res.body).toMatchObject({response_Code:'01',bill_status:' ',due_date:' '.repeat(8),date_paid:' '.repeat(8),amount_paid:' '.repeat(12),tran_auth_Id:' '.repeat(6)});
  });

  test.each(['10517210010001', '10010001'])('posts %s using the full number and the same duplicate key', async (suppliedConsumer) => {
    resolveOneBillConsumer.mockResolvedValueOnce('10517210010001');
    pool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{
        tenant_id: 'tenant-1', target_id: null, target_type: 'invoice', detail: 'Test Student',
      }]]);
    postPayment.mockResolvedValueOnce({ consumerNumber: '10517210010001' });
    const res = response();
    await billPayment1Link({
      body: {
        consumer_number: suppliedConsumer, tran_auth_id: '123456', transaction_amount: '000000500000',
        tran_date: '20260908', tran_time: '101112', bank_mnemonic: 'UBL00001', reserved: '',
      },
      ip: '10.95.8.92', headers: {},
    }, res);

    expect(postPayment).toHaveBeenCalledWith(expect.objectContaining({
      consumerNumber: '10517210010001',
      amount: 5000,
      transactionId: '123456',
      idempotencyKey: '10517210010001:123456:20260908:101112',
      source: 'onelink',
    }));
    expect(resolveOneBillConsumer).toHaveBeenCalledWith(suppliedConsumer);
    expect(pool.query.mock.calls[0][1]).toEqual(['10517210010001', '10517210010001:123456:20260908:101112']);
    expect(res.body).toEqual({ response_Code: '00', reserved: '', identification_parameter: 'Test Student' });
    expect(JSON.stringify(res.body)).toBe('{"response_Code":"00","reserved":"","identification_parameter":"Test Student"}');
  });

  test('rejects an ambiguous number before posting or selecting payment targets', async () => {
    resolveOneBillConsumer.mockRejectedValueOnce({ code: 'AMBIGUOUS_CONSUMER_NUMBER' });
    const res = response();
    await billPayment1Link({ body: {
      consumer_number: '10517210010001', tran_auth_id: '123456', transaction_amount: '000000500000',
      tran_date: '20260908', tran_time: '101112', bank_mnemonic: 'UBL',
    } }, res);
    expect(res.body.response_Code).toBe('04');
    expect(postPayment).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });

  test.each([
    ['CONSUMER_BLOCKED', '02'], ['BILL_NOT_FOUND', '01'],
    ['BILL_EXPIRED', '01'], ['BILL_NOT_PAYABLE', '01'],
    ['TENANT_SUSPENDED', '01'], ['ALREADY_PAID', '06'],
    ['AMOUNT_MISMATCH', '02'], ['INVALID_AMOUNT', '04'],
  ])('maps payment rejection %s to %s', async (code, expected) => {
    pool.query.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[{
      tenant_id: 'tenant-1', target_id: null, target_type: 'invoice', detail: 'Test Student',
    }]]);
    postPayment.mockRejectedValueOnce({ code });
    const res = response();
    await billPayment1Link({ body: {
      consumer_number: '10010018', tran_auth_id: '123456', transaction_amount: '000000500000',
      tran_date: '20261007', tran_time: '101112', bank_mnemonic: 'UBL', reserved: '',
    }, ip: '10.95.8.92', headers: {} }, res);
    expect(res.body).toEqual({ response_Code: expected, reserved: '', identification_parameter: '' });
  });

  test.each(['', '            ', null, undefined, 0, '0', '000000000000'])('declines blank/zero amount %p with 02 without database access', async (transaction_amount) => {
    const res = response();
    await billPayment1Link({ body: {
      consumer_number: '10010034', tran_auth_id: '123456', transaction_amount,
      tran_date: '20261009', tran_time: '101112', bank_mnemonic: 'UBL', reserved: '',
    } }, res);
    expect(res.body).toEqual({ response_Code: '02', reserved: '', identification_parameter: '' });
    expect(resolveOneBillConsumer).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
    expect(postPayment).not.toHaveBeenCalled();
  });

  test.each(['bad-amount', '-00000000001', '1.00', false])('keeps malformed amount %p as 04', async (transaction_amount) => {
    const res = response();
    await billPayment1Link({ body: {
      consumer_number: '10010034', tran_auth_id: '123456', transaction_amount,
      tran_date: '20261009', tran_time: '101112', bank_mnemonic: 'UBL',
    } }, res);
    expect(res.body.response_Code).toBe('04');
    expect(pool.query).not.toHaveBeenCalled();
    expect(postPayment).not.toHaveBeenCalled();
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
    expect(res.body).toEqual({response_Code:'03',reserved:'',identification_parameter:''});
    expect(postPayment).not.toHaveBeenCalled();
  });
});

test.each([['20260230','101112'],['20260908','240000'],['20261301','101112']])('rejects impossible provider date/time %s %s before touching the database', async (tran_date,tran_time) => {
  jest.clearAllMocks();
  const res=response();
  await billPayment1Link({body:{consumer_number:'10517210010001',tran_auth_id:'123456',transaction_amount:'000000500000',tran_date,tran_time,bank_mnemonic:'UBL'}},res);
  expect(res.body.response_Code).toBe('04');
  expect(pool.query).not.toHaveBeenCalled();
});
