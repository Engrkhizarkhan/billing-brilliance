import { test, expect } from '@playwright/test';

test('testing organization sees guidance and cannot create a production payment request', async ({ page, request }) => {
  test.setTimeout(60000);
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  const pin = process.env.E2E_ADMIN_PIN;
  if (!adminPassword || !pin) throw new Error('Set E2E_ADMIN_PASSWORD and E2E_ADMIN_PIN');
  const suffix = Date.now().toString().slice(-7);
  const tenantName = `Lifecycle UI QA ${suffix}`;
  const userEmail = `lifecycle-ui-${suffix}@example.test`;
  const userPassword = 'Testing-Org-2026!';
  let tenantId = '';
  let adminToken = '';

  try {
    const adminLogin = await request.post('/api/auth/login', { data: { email: process.env.E2E_ADMIN_EMAIL || 'admin@example.com', password: adminPassword } });
    expect(adminLogin.ok()).toBeTruthy();
    adminToken = (await adminLogin.json()).data.token;
    const headers = { Authorization: `Bearer ${adminToken}` };
    const createdTenant = await request.post('/api/tenants', { headers, data: { name: tenantName, type: 'org', email: userEmail, phone: '03000000000', consumerNumberLength: 24 } });
    expect(createdTenant.ok()).toBeTruthy();
    tenantId = (await createdTenant.json()).data.id;
    const createdUser = await request.post('/api/users', { headers, data: { name: 'Lifecycle Tester', email: userEmail, password: userPassword, role: 'org', tenantId, status: 'active', verified: true } });
    expect(createdUser.ok()).toBeTruthy();

    await page.goto('/login');
    await page.getByLabel(/email/i).fill(userEmail);
    await page.getByLabel(/password/i).fill(userPassword);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/org(?:\/)?$/);
    await expect(page.getByText(/Testing phase — you may prepare people and settings/i)).toBeVisible();

    await page.getByRole('button', { name: 'Payments', exact: true }).click();
    await page.getByPlaceholder('STU-9981').fill(`AP-${suffix}`);
    await page.getByPlaceholder('APP-44521').fill(`APP-${suffix}`);
    await page.getByPlaceholder('LECTURER-2026').fill(`POST-${suffix}`);
    await page.getByPlaceholder('1200').fill('2500');
    await page.getByPlaceholder('T-Groups (Ali Khan)').fill('Lifecycle Test Customer');
    await page.getByRole('button', { name: 'Create Payment Request' }).click();
    await expect(page.getByText(/still in testing and is not enabled for production payments/i)).toBeVisible();
    await expect(page.getByText(/Record payment/i)).toHaveCount(0);

    await page.getByRole('button', { name: 'API Integration' }).click();
    await expect(page.getByText('/api/payments?page=1&limit=30')).toBeVisible();
    await expect(page.getByText(/BillInquiry/)).toHaveCount(0);
    await expect(page.getByText(/BillPayment/)).toHaveCount(0);

    await page.getByRole('button', { name: 'Real-Time Pay' }).click();
    await expect(page.getByText(/Live feed of confirmed payment transactions/i)).toBeVisible();
    await expect(page.getByText(/Pause live refresh|Resume live refresh/)).toHaveCount(0);

    await page.getByRole('button', { name: 'API Sandbox' }).click();
    await expect(page.getByRole('heading', { name: 'API Sandbox' })).toBeVisible();
    await expect(page.getByText('Production isolation')).toBeVisible();
    await expect(page.getByLabel('X-API-Key')).toBeVisible();
    await page.screenshot({ path: 'test-results/org-testing-sandbox.png', fullPage: true });
  } finally {
    if (tenantId && adminToken) {
      const headers = { Authorization: `Bearer ${adminToken}` };
      await request.patch(`/api/tenants/${tenantId}/status`, { headers, data: { status: 'suspended', reason: 'Disposable lifecycle browser test' } });
      await request.post(`/api/tenants/${tenantId}/offboard`, { headers, data: { confirmation: tenantName, reason: 'Remove disposable lifecycle browser test', pin } });
    }
  }
});
