import { test, expect } from '@playwright/test';

test('admin key reveal, regeneration, and biller offboarding require the privileged PIN', async ({ page }) => {
  test.setTimeout(90000);
  const password = process.env.E2E_ADMIN_PASSWORD;
  const pin = process.env.E2E_ADMIN_PIN;
  if (!password || !pin) throw new Error('Set E2E_ADMIN_PASSWORD and E2E_ADMIN_PIN');
  const suffix = Date.now().toString().slice(-7);
  const name = `PIN QA ${suffix}`;

  await page.goto('/login');
  await page.getByLabel(/email/i).fill(process.env.E2E_ADMIN_EMAIL || 'admin@example.com');
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin(?:\/)?$/);
  await page.getByRole('button', { name: 'Billers' }).click();

  await page.getByRole('button', { name: 'Create New Biller' }).click();
  const create = page.getByRole('dialog');
  await create.getByLabel('Organization Name').fill(name);
  await create.getByLabel('Type').click();
  await page.getByRole('option', { name: 'Organization', exact: true }).click();
  await create.getByLabel('Email').fill(`pin-${suffix}@example.test`);
  await create.getByLabel('Phone').fill('03000000000');
  await create.getByRole('button', { name: 'Create Biller' }).click();

  const row = page.getByRole('row').filter({ hasText: name });
  await expect(row).toBeVisible();
  await row.getByTitle('Reveal with PIN').click();
  const reveal = page.getByRole('alertdialog');
  await expect(reveal.getByRole('heading', { name: 'Reveal API key?' })).toBeVisible();
  await reveal.getByLabel('Six-digit administrator PIN').fill(pin);
  await reveal.getByRole('button', { name: 'Reveal key' }).click();
  await expect(row).toContainText('fintap_live_');

  await row.getByTitle('Regenerate API key').click();
  const regenerate = page.getByRole('alertdialog');
  await regenerate.getByLabel('Type the organization name to continue').fill(name);
  await regenerate.getByLabel('Six-digit administrator PIN').fill(pin);
  await regenerate.getByRole('button', { name: /Regenerate and revoke old key/i }).click();
  await expect(row).toContainText('fintap_live_');

  await row.getByTitle('Suspend biller').click();
  const suspend = page.getByRole('alertdialog');
  await suspend.getByLabel('Reason (required)').fill('Disposable browser acceptance test');
  await suspend.getByRole('button', { name: 'Suspend biller' }).click();
  await expect(row).toContainText(/suspended/i);

  await row.getByTitle('Offboard biller').click();
  const offboard = page.getByRole('alertdialog');
  await offboard.getByLabel('Reason (required)').fill('Remove disposable browser acceptance test');
  await offboard.getByLabel(new RegExp(`Type ${name}`)).fill(name);
  await offboard.getByLabel('Six-digit administrator PIN').fill(pin);
  await offboard.getByRole('button', { name: 'Offboard and revoke access' }).click();
  await expect(row).toHaveCount(0);
});
