jest.mock('../../src/config/database', () => ({ pool: { getConnection: jest.fn(), query: jest.fn() } }));
jest.mock('../../src/middleware/auditLog', () => ({ auditLog: jest.fn() }));
jest.mock('../../src/services/notificationService', () => ({ createRequestNotification: jest.fn() }));

const { pool } = require('../../src/config/database');
const { createInvoice } = require('../../src/controllers/invoiceController');

const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json: jest.fn(function json(body) { this.body = body; return this; }),
});

describe('manual invoice creation', () => {
  beforeEach(() => jest.clearAllMocks());

  test('uses the authoritative tenant student and consumer number', async () => {
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn(),
      query: jest.fn()
        .mockResolvedValueOnce([[{ id: 'tenant-1', status: 'active', lifecycle_stage: 'live' }]])
        .mockResolvedValueOnce([[{ id: 'student-1', name: 'Verified Student', consumer_number: '10517210010001' }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[{ max_seq: 10000 }]])
        .mockResolvedValue([{}]),
    };
    pool.getConnection.mockResolvedValue(connection);
    pool.query.mockResolvedValueOnce([[{ id: 'invoice-1' }]]);
    const req = {
      tenantId: 'tenant-1',
      body: {
        studentId: 'student-1',
        studentName: 'Forged Name',
        consumerNumber: '99999999999999',
        month: '2026-09',
        amount: 4999,
        dueDate: '2026-10-05',
      },
    };
    const res = response();
    const next = jest.fn();

    await createInvoice(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
    expect(connection.query.mock.calls[4][1][0][0]).toEqual(expect.arrayContaining([
      'student-1', 'Verified Student', '10517210010001', '2026-09', 4999, '2026-10-05',
    ]));
  });

  test('rejects invalid amount before opening a transaction', async () => {
    const next = jest.fn();
    await createInvoice({ tenantId: 'tenant-1', body: {
      studentId: 'student-1', month: '2026-09', amount: 0, dueDate: '2026-10-05',
    } }, response(), next);

    expect(pool.getConnection).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_AMOUNT' }));
  });
});
