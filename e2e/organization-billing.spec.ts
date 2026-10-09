import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
const config = require('../server/src/config');
require('../server/src/services/disposableDatabaseGuard').assertDisposableDatabase(config, process.env.INTEGRATION_DATABASE_CONFIRM);
const pool = require('../server/node_modules/mysql2/promise').createPool({ ...config.db, timezone: '+00:00', dateStrings: true });
const bcrypt = require('../server/node_modules/bcryptjs');
const tenantId = randomUUID(), userId = randomUUID(), postingId = randomUUID();
const password = 'Browser-Billing-Fixture!2026';
test.beforeAll(async () => {
  await pool.query("INSERT INTO tenants (id,name,type,biller_code,email,status,lifecycle_stage,consumer_number_length,next_consumer_sequence) VALUES (?,'Browser Organization','org','8199',?,'active','live',24,1)",[tenantId,`${tenantId}@example.test`]);
  await pool.query("INSERT INTO users (id,tenant_id,name,email,password_hash,role,status) VALUES (?,?,'Organization Admin',?,?,'org','active')",[userId,tenantId,`${userId}@example.test`,await bcrypt.hash(password,4)]);
  await pool.query("INSERT INTO org_postings (id,tenant_id,title,type,application_fee,status) VALUES (?,?,'Admission 2026','entry_test',2500,'active')",[postingId,tenantId]);
});
test.afterAll(async () => {
  for(const table of ['audit_logs','notifications','org_payment_notifications','org_payment_records','org_postings','refresh_tokens','users']) {
    if(table==='refresh_tokens') await pool.query('DELETE FROM refresh_tokens WHERE user_id = ?',[userId]);
    else await pool.query(`DELETE FROM ${table} WHERE tenant_id = ?`,[tenantId]);
  }
  await pool.query('DELETE FROM tenants WHERE id = ?',[tenantId]);
  await pool.end();
});
test('organization form saves its late fee and keeps an overdue bill payable when Never expires is selected',async({page})=>{
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(`${userId}@example.test`);
  await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByRole('button',{name:/sign in/i}).click();
  await expect(page).toHaveURL(/\/org$/);
  await page.goto('/org/payments');
  await page.getByLabel('applicant_id',{exact:true}).fill('PARENT-1');
  await page.getByLabel('application_id',{exact:true}).fill('BROWSER-BILL-1');
  await page.getByLabel('Posting',{exact:true}).selectOption(postingId);
  await page.getByLabel('amount (PKR)',{exact:true}).fill('2500');
  await page.getByLabel('Due date (Pakistan time)',{exact:true}).fill('2020-09-30');
  await page.getByLabel('Late fee (PKR)',{exact:true}).fill('125.50');
  await page.getByLabel(/Never expires/).check();
  await page.getByLabel('customer_name (required)',{exact:true}).fill('Ahmed Parent');
  const response = page.waitForResponse(r=>r.url().endsWith('/api/payments/create') && r.request().method()==='POST');
  await page.getByRole('button',{name:'Create Payment Request',exact:true}).click();
  expect((await response).status()).toBe(201);
  await expect(page.getByText('201 Created',{exact:true})).toBeVisible();
  const [[row]]=await pool.query('SELECT amount,late_fee,due_date,expiry_date FROM org_payment_records WHERE tenant_id = ? AND application_id = ?',[tenantId,'BROWSER-BILL-1']);
  expect(Number(row.amount)).toBe(2500);
  expect(Number(row.late_fee)).toBe(125.50);
  expect(row.due_date).toBe('2020-09-30');
  expect(row.expiry_date).toBe('9999-12-31 23:59:59');
  await page.screenshot({path:'test-results/organization-late-fee-form.png',fullPage:true});
});
