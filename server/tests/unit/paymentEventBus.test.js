const { emitPaymentEvent, subscribe } = require('../../src/services/paymentEventBus');

describe('tenant payment event bus', () => {
  test('delivers only to the matching tenant and can unsubscribe', () => {
    const tenantA = jest.fn();
    const tenantB = jest.fn();
    const stopA = subscribe('tenant-a', tenantA);
    const stopB = subscribe('tenant-b', tenantB);
    emitPaymentEvent('tenant-a', { paymentId: 'payment-1' });
    expect(tenantA).toHaveBeenCalledWith({ paymentId: 'payment-1' });
    expect(tenantB).not.toHaveBeenCalled();
    stopA();
    stopB();
    emitPaymentEvent('tenant-a', { paymentId: 'payment-2' });
    expect(tenantA).toHaveBeenCalledTimes(1);
  });
});
