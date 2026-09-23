import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const config = require('../server/src/config');
require('../server/src/services/disposableDatabaseGuard').assertDisposableDatabase(config, process.env.INTEGRATION_DATABASE_CONFIRM);
const { pool } = require('../server/src/config/database');
const bcrypt = require('../server/node_modules/bcryptjs');
let tenantId: string, userId: string;
const password = 'Browser-Regression-Only!2026';
test.beforeAll(async () => {
  tenantId = randomUUID(); userId = randomUUID();
  const code = `Q${Date.now().toString().slice(-10)}`;
  await pool.query("INSERT INTO tenants (id,name,type,biller_code,email,status,lifecycle_stage) VALUES (?,'Browser Fixture','school',?,?,'active','testing')", [tenantId,code,`${tenantId}@example.test`]);
  await pool.query("INSERT INTO users (id,tenant_id,name,email,password_hash,role,school_access_role,status,school_ref) VALUES (?,?,'School Admin',?,?,'school','admin','active',?)",[userId,tenantId,`${userId}@example.test`,await bcrypt.hash(password,4),code]);
  const rows = Array.from({length:55},(_,i)=>[randomUUID(),tenantId,`Picker Student ${String(i+1).padStart(2,'0')}`,'Parent','Class 12',`105172${String(Date.now()).slice(-10)}${String(i+1).padStart(8,'0')}`,randomUUID()]);
  await pool.query('INSERT INTO students (id,tenant_id,name,father_name,class,consumer_number,bill_id) VALUES ?',[rows]);
});
test.afterAll(async () => {
  for (const table of ['audit_logs','notifications','students','users']) await pool.query(`DELETE FROM ${table} WHERE tenant_id = ?`,[tenantId]);
  await pool.query('DELETE FROM tenants WHERE id = ?',[tenantId]);
  await pool.end();
});
test.beforeEach(async ({page}) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(`${userId}@example.test`);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button',{name:/sign in/i}).click();
  await expect(page).toHaveURL(/\/school$/);
});

test('both student selectors load real records and search beyond their first page',async ({page}) => {
  const errors: string[]=[];
  page.on('response',response=>{ if(response.url().includes('/api/') && response.status()>=400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto('/school/payment-programs');
  await page.getByRole('button',{name:'Individual Assign'}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Showing 1–50 of 55')).toBeVisible();
  await dialog.getByRole('button',{name:'Next page',exact:true}).click();
  await expect(page.getByRole('dialog').getByText('Showing 51–55 of 55')).toBeVisible();
  await page.getByRole('dialog').getByPlaceholder(/Search by name/).fill('Picker Student 55');
  await expect(page.getByRole('dialog').getByText('Showing 1–1 of 1')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Picker Student 55',{exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('/school/scholarships');
  await page.getByRole('button',{name:'Assign Scholarship',exact:true}).click();
  await expect(page.getByRole('dialog').getByText('Showing 1–50 of 55')).toBeVisible();
  await page.getByRole('dialog').getByPlaceholder(/Search by name/).fill('Picker Student 55');
  await expect(page.getByRole('dialog').getByText('Picker Student 55',{exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('PDF export downloads a real PDF and CSV has the displayed records',async ({page}) => {
  await page.goto('/school/students');
  await expect(page.getByText(/^Picker Student \d+$/).first()).toBeVisible();
  const displayed = await page.getByText(/^Picker Student \d+$/).allTextContents();
  expect(displayed).toHaveLength(25);
  await page.getByRole('button',{name:'Export displayed rows',exact:true}).click();
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('menuitem',{name:'Export displayed rows (.pdf)',exact:true}).click();
  const pdf=await downloadPromise;
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  const bytes=await readFile((await pdf.path())!);
  expect(bytes.subarray(0,5).toString()).toBe('%PDF-');
  await page.getByRole('button',{name:'Export displayed rows',exact:true}).click();
  const csvPromise=page.waitForEvent('download');
  await page.getByRole('menuitem',{name:'Export displayed rows (.csv)',exact:true}).click();
  const csv=await csvPromise;
  const text=await readFile((await csv.path())!,'utf8');
  const exported = require('papaparse').parse(text, { header: true }).data.map((row: { Name: string }) => row.Name);
  expect(exported).toEqual(displayed);
});

test('a failed data request shows an error instead of an empty student list',async ({page}) => {
  await page.route('**/api/students?**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Student service unavailable'})}));
  await page.goto('/school/payment-programs');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('Student service unavailable')).toBeVisible();
  await expect(page.getByRole('button',{name:'Retry'})).toBeVisible();
});
