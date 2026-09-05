const { isPrivateIp } = require('../../src/services/urlSafety');

describe('outbound URL IP safety', () => {
  test.each([
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.10',
    '169.254.169.254',
    '::1',
    'fd00::1',
    '::ffff:127.0.0.1',
  ])('blocks private or restricted address %s', (address) => {
    expect(isPrivateIp(address)).toBe(true);
  });

  test.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])(
    'accepts public address %s',
    (address) => expect(isPrivateIp(address)).toBe(false)
  );
});
