import { test, expect } from '@playwright/test';

test('admin can inspect a consumer as a card and a 1BILL response', async ({ page }) => {
  const password = process.env.E2E_ADMIN_PASSWORD;
  const consumerNumber = process.env.E2E_CONSUMER_NUMBER;
  if (!password || !consumerNumber) {
    throw new Error('Set E2E_ADMIN_PASSWORD and E2E_CONSUMER_NUMBER before running this test');
  }

  await page.goto('/login');
  await page.getByLabel(/email/i).fill(process.env.E2E_ADMIN_EMAIL || 'admin@example.com');
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin(?:\/)?$/);

  await page.getByRole('button', { name: 'Verify Payment' }).click();
  await expect(page).toHaveURL(/\/admin\/verify-payment$/);
  await expect(page.getByRole('heading', { name: 'Verify Payment' })).toBeVisible();

  await page.getByLabel('Consumer number').fill(consumerNumber);
  await page.getByRole('button', { name: 'Verify consumer' }).click();

  await expect(page.getByText('Consumer details')).toBeVisible();
  await expect(page.getByText('1BILL API response')).toBeVisible();
  await expect(page.locator('pre')).toContainText('response_Code');
  await expect(page.locator('pre')).toContainText('bill_status');
  await expect(page.getByText(consumerNumber, { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Record verified funds' })).toBeVisible();
  await expect(page.getByLabel('Received at')).toBeVisible();
  await expect(page.getByLabel('Receipt / bank reference')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record exact payment' })).toBeDisabled();

  await page.screenshot({ path: 'test-results/admin-payment-verification.png', fullPage: true });
});
