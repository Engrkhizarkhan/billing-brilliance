const { subscribe } = require('../services/paymentEventBus');

const stream = (req, res) => {
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const send = (event, payload) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
  send('ready', { connected: true, tenantId: req.tenantId, timestamp: new Date().toISOString() });

  const unsubscribe = subscribe(req.tenantId, (payload) => send('payment', payload));
  const heartbeat = setInterval(() => send('heartbeat', { timestamp: new Date().toISOString() }), 25000);
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
};

module.exports = { stream };
