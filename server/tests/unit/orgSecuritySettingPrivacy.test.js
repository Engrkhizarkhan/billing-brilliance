jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../src/middleware/auditLog', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../src/services/notificationService', () => ({ createRequestNotification: jest.fn() }));

const { pool } = require('../../src/config/database');
const { getSetting, upsertSetting } = require('../../src/controllers/settingsController');

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

describe('organization security-setting privacy', () => {
  beforeEach(() => jest.clearAllMocks());

  test('organization users receive only configured state and address count', async () => {
    pool.query.mockResolvedValueOnce([[
      { value: JSON.stringify({ sourceIp: ['10.95.8.92', '10.95.8.94'] }) },
    ]]);
    const res = response();
    const next = jest.fn();

    await getSetting({
      tenantId: 'tenant-1', body: {}, query: {}, params: { key: 'org_security_context' },
      user: { role: 'org' },
    }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.body).toEqual({ data: { configured: true, sourceIpCount: 2 } });
    expect(JSON.stringify(res.body)).not.toContain('10.95.8.92');
  });

  test('platform administrators retain full visibility', async () => {
    pool.query.mockResolvedValueOnce([[
      { value: JSON.stringify({ sourceIp: ['10.95.8.92', '10.95.8.94'] }) },
    ]]);
    const res = response();

    await getSetting({
      tenantId: 'tenant-1', body: {}, query: {}, params: { key: 'org_security_context' },
      user: { role: 'admin' },
    }, res, jest.fn());

    expect(res.body).toEqual({ data: { sourceIp: ['10.95.8.92', '10.95.8.94'] } });
  });

  test('organization save responses do not echo the submitted addresses', async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = response();
    const next = jest.fn();

    await upsertSetting({
      tenantId: 'tenant-1', query: {}, params: { key: 'org_security_context' },
      user: { role: 'org' }, body: { value: { sourceIp: ['10.95.8.92', '10.95.8.94'] } },
    }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.body).toEqual({
      data: { configured: true, sourceIpCount: 2 },
      message: 'Setting saved',
    });
    expect(JSON.stringify(res.body)).not.toContain('10.95.8.94');
  });
});

