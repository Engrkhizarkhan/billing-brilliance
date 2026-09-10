const { EventEmitter } = require('events');

const emitter = new EventEmitter();
emitter.setMaxListeners(1000);

const emitPaymentEvent = (tenantId, payload) => {
  if (!tenantId) return;
  emitter.emit(`tenant:${tenantId}`, payload);
};

const subscribe = (tenantId, listener) => {
  const event = `tenant:${tenantId}`;
  emitter.on(event, listener);
  return () => emitter.off(event, listener);
};

module.exports = { emitPaymentEvent, subscribe };
