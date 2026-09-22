jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() }, testConnection: jest.fn() }));
jest.mock('../../src/services/urlSafety', () => ({ assertSafePublicHttpsUrl: jest.fn(value=>Promise.resolve(value)) }));
jest.mock('../../src/services/safeWebhookTransport', () => ({ sendWebhook: jest.fn() }));
const crypto=require('crypto');
const { pool }=require('../../src/config/database');
const { sendWebhook }=require('../../src/services/safeWebhookTransport');
const { deliver }=require('../../src/workers/outboxWorker');
const event={id:'event-1',tenant_id:'tenant-1',event_type:'payment.posted',created_at:'2026-09-23 10:00:00',payload:{paymentId:'payment-1',applicationId:'app-1',amount:100}};
beforeEach(()=>jest.clearAllMocks());
test('signs the exact versioned body and marks delivered only after a 2xx acknowledgement',async()=>{
  pool.query.mockResolvedValueOnce([[{status:'active',settings:{notification_url:'https://receiver.example.test/',webhook_secret:'receiver-test-secret'}}]]).mockResolvedValue([{}]);
  sendWebhook.mockResolvedValue({ok:true,status:204});
  await deliver(event);
  const [,request]=sendWebhook.mock.calls[0];
  expect(JSON.parse(request.body)).toMatchObject({schema_version:1,event_id:event.id,data:{applicationId:'app-1'}});
  expect(request.headers['X-Webhook-Signature']).toBe(crypto.createHmac('sha256','receiver-test-secret').update(request.body).digest('hex'));
  expect(pool.query.mock.calls[1][0]).toContain("status = 'delivered'");
});
test('missing destination is explicitly skipped, never called delivered',async()=>{
  pool.query.mockResolvedValueOnce([[{status:'active',settings:{}}]]).mockResolvedValue([{}]);
  await deliver(event);
  expect(sendWebhook).not.toHaveBeenCalled();
  expect(pool.query.mock.calls[1][0]).toContain("status = 'skipped'");
});
test('suspension prevents delivery',async()=>{
  pool.query.mockResolvedValueOnce([[{status:'suspended',settings:{notification_url:'https://receiver.example.test/'}}]]);
  await expect(deliver(event)).rejects.toThrow('suspended');
  expect(sendWebhook).not.toHaveBeenCalled();
});
