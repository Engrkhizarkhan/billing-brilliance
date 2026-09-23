const https = require('https');
const { resolveSafePublicHttpsUrl } = require('./urlSafety');

// Validate once and pin that exact DNS result to the TLS connection. No redirects,
// proxy environment variables, pooled sockets, or subsequent DNS resolutions.
const sendWebhook = async (url, { headers = {}, body }) => {
  const { url: target, addresses } = await resolveSafePublicHttpsUrl(url);
  return new Promise((resolve, reject) => {
    let timer;
    const request = https.request(target, {
      method: 'POST', agent: false,
      headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
      lookup: (_hostname, options, callback) => {
        if (options?.all) callback(null, addresses);
        else callback(null, addresses[0].address, addresses[0].family);
      },
    }, response => {
      const status = response.statusCode || 0;
      clearTimeout(timer);
      response.destroy();
      resolve({ status, ok: status >= 200 && status < 300 });
    });
    timer = setTimeout(() => request.destroy(new Error('Webhook timed out')), 8000);
    request.on('error', error => { clearTimeout(timer); reject(error); });
    request.end(body);
  });
};
module.exports = { sendWebhook };
