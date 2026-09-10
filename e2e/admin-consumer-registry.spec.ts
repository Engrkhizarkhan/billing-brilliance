import { test, expect } from '@playwright/test';

test('admin can search and filter the cross-tenant consumer-number registry', async ({ page }) => {
  test.setTimeout(60000);
  const password = process.env.E2E_ADMIN_PASSWORD;
  const consumerNumber = process.env.E2E_CONSUMER_NUMBER;
  if (!password || !consumerNumber) throw new Error('Set E2E_ADMIN_PASSWORD and E2E_CONSUMER_NUMBER');

  await page.goto('/login');
  await page.getByLabel(/email/i).fill(process.env.E2E_ADMIN_EMAIL || 'admin@example.com');
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin(?:\/)?$/);

  await page.getByRole('button', { name: 'Consumer Numbers' }).click();
  await expect(page).toHaveURL(/\/admin\/consumer-numbers$/);
  await expect(page.getByRole('heading', { name: 'Consumer Numbers' })).toBeVisible();
  await expect(page.getByText('Matching numbers')).toBeVisible();
  await expect(page.getByLabel('Filter by biller')).toBeVisible();
  await expect(page.getByLabel('Filter by source')).toBeVisible();
  await expect(page.getByLabel('Filter by number length')).toBeVisible();

  await page.getByLabel('Filter by source').click();
  await page.getByRole('option', { name: 'School students' }).click();
  await page.getByLabel('Filter by number length').click();
  await page.getByRole('option', { name: '24 digits', exact: true }).click();
  await page.getByLabel('Search consumer numbers').fill(consumerNumber);

  const row = page.getByRole('row').filter({ hasText: consumerNumber });
  await expect(row).toBeVisible();
  await expect(row).toContainText('School student');
  await expect(row).toContainText('24 digits');
  await page.screenshot({ path: 'test-results/admin-consumer-registry.png', fullPage: true });
});
