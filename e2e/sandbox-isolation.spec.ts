import { test, expect } from '@playwright/test';

test('sandbox key is isolated and revoked by live activation', async ({ request }) => {
  test.setTimeout(60000);
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  const pin = process.env.E2E_ADMIN_PIN;
  if (!adminPassword || !pin) throw new Error('Set E2E_ADMIN_PASSWORD and E2E_ADMIN_PIN');
  const suffix = Date.now().toString().slice(-7);
  const tenantName = `Sandbox QA ${suffix}`;
  let tenantId = '';
  let token = '';

  try {
    const login = await request.post('/api/auth/login', { data: { email: process.env.E2E_ADMIN_EMAIL || 'admin@example.com', password: adminPassword } });
    expect(login.ok()).toBeTruthy();
    token = (await login.json()).data.token;
    const headers = { Authorization: `Bearer ${token}` };
    const tenantResponse = await request.post('/api/tenants', { headers, data: { name: tenantName, type: 'org', email: `sandbox-${suffix}@example.test`, phone: '03000000000', consumerNumberLength: 24 } });
    expect(tenantResponse.ok()).toBeTruthy();
    tenantId = (await tenantResponse.json()).data.id;

    const provisioned = await request.post(`/api/tenants/${tenantId}/provision-sandbox`, {
      headers, data: { pin, confirmation: `PROVISION ${tenantId}` },
    });
    expect(provisioned.ok()).toBeTruthy();
    const sandboxKey = (await provisioned.json()).data.apiKey as string;
    expect(sandboxKey).toMatch(/^fintap_test_/);

    const rejectedByProduction = await request.post('/api/saas/v1/check-payment', {
      headers: { 'X-API-Key': sandboxKey }, data: { consumerNumber: '10517200000000' },
    });
    expect(rejectedByProduction.status()).toBe(401);

    const registered = await request.post('http://127.0.0.1:3001/api/saas/v1/register-consumer', {
      headers: { 'X-API-Key': sandboxKey },
      data: { name: 'Sandbox Customer', fatherName: 'Synthetic Record', class: 'UAT', gender: 'male', externalRef: `EXT-${suffix}`, invoice: { amount: 2500, dueDate: '2026-12-31', description: 'Sandbox invoice' } },
    });
    expect(registered.status()).toBe(201);
    const consumerNumber = (await registered.json()).consumerNumber as string;

    const beforePayment = await request.post('http://127.0.0.1:3001/api/saas/v1/check-payment', { headers: { 'X-API-Key': sandboxKey }, data: { consumerNumber } });
    expect(await beforePayment.json()).toMatchObject({ paid: false, status: 'pending' });
    const payment = await request.post('http://127.0.0.1:3001/api/saas/v1/make-payment', {
      headers: { 'X-API-Key': sandboxKey, 'X-Idempotency-Key': `SANDBOX-${suffix}` },
      data: { consumerNumber, amount: 2500, reference: `SANDBOX-${suffix}`, channel: 'sandbox_simulator', note: 'Isolated UAT payment' },
    });
    expect(payment.status()).toBe(201);
    const afterPayment = await request.post('http://127.0.0.1:3001/api/saas/v1/check-payment', { headers: { 'X-API-Key': sandboxKey }, data: { consumerNumber } });
    expect(await afterPayment.json()).toMatchObject({ paid: true, status: 'paid' });

    const activated = await request.patch(`/api/tenants/${tenantId}/lifecycle`, {
      headers,
      data: {
        lifecycleStage: 'live', pin, confirmation: `ACTIVATE ${tenantId}`,
        reason: 'Automated sandbox isolation acceptance',
        checklist: { profileComplete: true, credentialsIssued: true, ipAllowlistConfigured: true, uatPassed: true, supportContactsRecorded: true },
      },
    });
    expect(activated.ok()).toBeTruthy();

    const revoked = await request.post('http://127.0.0.1:3001/api/saas/v1/check-payment', { headers: { 'X-API-Key': sandboxKey }, data: { consumerNumber } });
    expect(revoked.status()).toBe(401);
  } finally {
    if (tenantId && token) {
      const headers = { Authorization: `Bearer ${token}` };
      await request.patch(`/api/tenants/${tenantId}/status`, { headers, data: { status: 'suspended', reason: 'Remove disposable sandbox acceptance tenant' } });
      await request.post(`/api/tenants/${tenantId}/offboard`, { headers, data: { pin, confirmation: tenantName, reason: 'Remove disposable sandbox acceptance tenant' } });
    }
  }
});
