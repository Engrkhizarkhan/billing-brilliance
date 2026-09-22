jest.mock('../../src/services/urlSafety', () => ({ resolveSafePublicHttpsUrl: jest.fn() }));
jest.mock('https', () => ({ request: jest.fn() }));
const https = require('https');
const { EventEmitter } = require('events');
const { resolveSafePublicHttpsUrl } = require('../../src/services/urlSafety');
const { sendWebhook } = require('../../src/services/safeWebhookTransport');
afterEach(() => jest.clearAllMocks());
test('pins the validated DNS address and does not follow redirects', async () => {
  resolveSafePublicHttpsUrl.mockResolvedValue({ url:'https://callback.example.test/',addresses:[{address:'93.184.216.34',family:4}] });
  https.request.mockImplementation((url, options, callback) => {
    expect(options.agent).toBe(false);
    options.lookup('callback.example.test',{},(err,address)=>expect(address).toBe('93.184.216.34'));
    const req=new EventEmitter(); req.end=()=>callback({statusCode:302,destroy:jest.fn()}); return req;
  });
  await expect(sendWebhook('https://callback.example.test/',{body:'{}'})).resolves.toEqual({status:302,ok:false});
  expect(https.request).toHaveBeenCalledTimes(1);
});
test('rejects unsafe destinations before opening a connection', async () => {
  resolveSafePublicHttpsUrl.mockRejectedValue(new Error('Private destination'));
  await expect(sendWebhook('https://127.0.0.1/',{body:'{}'})).rejects.toThrow('Private destination');
  expect(https.request).not.toHaveBeenCalled();
});
