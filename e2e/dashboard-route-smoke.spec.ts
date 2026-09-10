import { test, expect, type Browser, type Page } from '@playwright/test';

type Login = { email: string; password: string };

const openPortal = async (browser: Browser, login: Login) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(login.email);
  await page.getByLabel(/password/i).fill(login.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  return { context, page };
};

const auditRoutes = async (page: Page, routes: string[], screenshotPath: string) => {
  const failures: string[] = [];
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 500) {
      failures.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByText('Something went wrong', { exact: false })).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/login$/);
    await page.waitForTimeout(350);
  }

  await page.screenshot({ path: screenshotPath, fullPage: true });
  expect(pageErrors, `Browser errors while visiting ${routes.join(', ')}`).toEqual([]);
  expect(failures, `API 5xx responses while visiting ${routes.join(', ')}`).toEqual([]);
};

test('every admin, school, and organization dashboard route renders without browser errors or API 5xx responses', async ({ browser, request }) => {
  test.setTimeout(150000);
  const adminEmail = process.env.E2E_ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  const pin = process.env.E2E_ADMIN_PIN;
  if (!adminPassword || !pin) throw new Error('Set E2E_ADMIN_PASSWORD and E2E_ADMIN_PIN');

  const suffix = Date.now().toString().slice(-7);
  const schoolName = `Route School QA ${suffix}`;
  const orgName = `Route Org QA ${suffix}`;
  const schoolEmail = `route-school-${suffix}@example.test`;
  const orgEmail = `route-org-${suffix}@example.test`;
  const tenantPassword = 'Route-Smoke-2026!';
  let adminToken = '';
  let schoolTenantId = '';
  let orgTenantId = '';

  try {
    const loginResponse = await request.post('/api/auth/login', { data: { email: adminEmail, password: adminPassword } });
    expect(loginResponse.ok()).toBeTruthy();
    adminToken = (await loginResponse.json()).data.token;
    const headers = { Authorization: `Bearer ${adminToken}` };

    const schoolTenant = await request.post('/api/tenants', {
      headers,
      data: { name: schoolName, type: 'school', email: schoolEmail, phone: '03000000000', consumerNumberLength: 24 },
    });
    expect(schoolTenant.ok()).toBeTruthy();
    schoolTenantId = (await schoolTenant.json()).data.id;
    const schoolUser = await request.post('/api/users', {
      headers,
      data: { name: 'Route School User', email: schoolEmail, password: tenantPassword, role: 'school', tenantId: schoolTenantId, status: 'active', verified: true },
    });
    expect(schoolUser.ok()).toBeTruthy();

    const orgTenant = await request.post('/api/tenants', {
      headers,
      data: { name: orgName, type: 'org', email: orgEmail, phone: '03000000000', consumerNumberLength: 24 },
    });
    expect(orgTenant.ok()).toBeTruthy();
    orgTenantId = (await orgTenant.json()).data.id;
    const orgUser = await request.post('/api/users', {
      headers,
      data: { name: 'Route Org User', email: orgEmail, password: tenantPassword, role: 'org', tenantId: orgTenantId, status: 'active', verified: true },
    });
    expect(orgUser.ok()).toBeTruthy();

    const admin = await openPortal(browser, { email: adminEmail, password: adminPassword });
    await auditRoutes(admin.page, [
      '/admin', '/admin/billers', '/admin/users', '/admin/transactions', '/admin/consumer-numbers',
      '/admin/verify-payment', '/admin/cashflow', '/admin/reports', '/admin/audit',
    ], 'test-results/route-smoke-admin.png');
    await admin.context.close();

    const school = await openPortal(browser, { email: schoolEmail, password: tenantPassword });
    await auditRoutes(school.page, [
      '/school', '/school/students', '/school/fee-plans', '/school/fee-ledger',
      '/school/scholarships', '/school/billing', '/school/invoices', '/school/defaulters',
      '/school/payments', '/school/realtime-payments', '/school/payment-programs',
      '/school/reports', '/school/login-activity', '/school/settings',
    ], 'test-results/route-smoke-school.png');
    await school.context.close();

    const org = await openPortal(browser, { email: orgEmail, password: tenantPassword });
    await auditRoutes(org.page, [
      '/org', '/org/payments', '/org/history', '/org/realtime-payments', '/org/invoices',
      '/org/reports', '/org/sandbox', '/org/api-integration', '/org/webhook-config',
      '/org/settings', '/org/login-activity',
    ], 'test-results/route-smoke-org.png');
    await org.page.goto('/org/reference');
    await expect(org.page).toHaveURL(/\/org\/api-integration$/);
    await org.page.goto('/org/api-reference');
    await expect(org.page).toHaveURL(/\/org\/api-integration$/);
    await org.context.close();
  } finally {
    if (adminToken) {
      const headers = { Authorization: `Bearer ${adminToken}` };
      for (const tenant of [
        { id: schoolTenantId, name: schoolName },
        { id: orgTenantId, name: orgName },
      ]) {
        if (!tenant.id) continue;
        await request.patch(`/api/tenants/${tenant.id}/status`, {
          headers, data: { status: 'suspended', reason: 'Remove disposable route smoke tenant' },
        });
        await request.post(`/api/tenants/${tenant.id}/offboard`, {
          headers, data: { pin, confirmation: tenant.name, reason: 'Remove disposable route smoke tenant' },
        });
      }
    }
  }
});
