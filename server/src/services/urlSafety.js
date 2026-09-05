const dns = require('dns').promises;
const net = require('net');

const isPrivateIpv4 = (address) => {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19));
};

const isPrivateIp = (address) => {
  if (net.isIPv4(address)) return isPrivateIpv4(address);
  const normalized = address.toLowerCase();
  if (normalized === '::' || normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
  if (normalized.startsWith('::ffff:')) return isPrivateIpv4(normalized.slice(7));
  return false;
};

const assertSafePublicHttpsUrl = async (value) => {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Webhook URL is invalid');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Webhook URL must use HTTPS and cannot contain credentials');
  if (parsed.port && parsed.port !== '443') throw new Error('Webhook URL must use port 443');
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) throw new Error('Webhook URL must use a public hostname');
  const addresses = net.isIP(hostname) ? [{ address: hostname }] : await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) throw new Error('Webhook URL resolves to a private or restricted address');
  return parsed.toString();
};

module.exports = { assertSafePublicHttpsUrl, isPrivateIp };
