import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const config=require('../server/src/config');
require('../server/src/services/disposableDatabaseGuard').assertDisposableDatabase(config,process.env.INTEGRATION_DATABASE_CONFIRM);
const pool=require('../server/node_modules/mysql2/promise').createPool({...config.db,timezone:'+00:00',dateStrings:true});
const bcrypt=require('../server/node_modules/bcryptjs');
const tenant=randomUUID(),user=randomUUID(),student=randomUUID(),password='Local-Bill-Fixture!2026';
test.beforeAll(async()=>{
  await pool.query("INSERT INTO tenants (id,name,type,biller_code,email,status,lifecycle_stage,consumer_number_length,billing_mode) VALUES (?,'Installment Browser','school','8299',?,'active','live',17,'invoice')",[tenant,`${tenant}@example.test`]);
  await pool.query("INSERT INTO users (id,tenant_id,name,email,password_hash,role,school_access_role,status) VALUES (?,?,'School Admin',?,?,'school','admin','active')",[user,tenant,`${user}@example.test`,await bcrypt.hash(password,4)]);
  await pool.query("INSERT INTO students (id,tenant_id,name,father_name,class,bill_id,consumer_number,status) VALUES (?,?,'Ayesha Student','Parent','University',?,NULL,'active')",[student,tenant,randomUUID()]);
});
test.afterAll(async()=>{
  for(const table of ['audit_logs','notifications','ledger_entries','invoice_installment_plans','invoice_requests','invoices','students','consumer_number_reservations'])await pool.query(`DELETE FROM ${table} WHERE tenant_id=?`,[tenant]);
  await pool.query('DELETE FROM refresh_tokens WHERE user_id=?',[user]);await pool.query('DELETE FROM users WHERE id=?',[user]);await pool.query('DELETE FROM tenants WHERE id=?',[tenant]);await pool.end();
});
test('institution issues a bill, enables installments and shares the new bill-specific slip',async({page})=>{
  await page.goto('/login');await page.getByLabel(/email/i).fill(`${user}@example.test`);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:/sign in/i}).click();await expect(page).toHaveURL(/\/school$/);
  await page.goto('/school/invoices');await page.getByRole('button',{name:'Create Invoice',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.locator('select').selectOption(student);await dialog.locator('input[type="number"]').first().fill('12000');await dialog.getByLabel('Late Fee (PKR)',{exact:true}).fill('120');await dialog.locator('input[type="date"]').fill('2099-01-31');
  await dialog.getByRole('button',{name:'Create Invoice',exact:true}).click();await expect(dialog).not.toBeVisible();
  await expect(page.getByText('10517282990000001',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Enable installments',exact:true}).click();await expect(page.getByRole('button',{name:'Disable new installment plans',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Split into installments',exact:true}).click();
  await expect(page.getByLabel('Amount 1 (PKR)',{exact:true})).toHaveValue('6000.00');await expect(page.getByLabel('Due date 2',{exact:true})).toHaveValue('2099-02-28');
  await page.getByRole('button',{name:'Create installment bills',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByText('10517282990000001',{exact:true})).not.toBeVisible();
  await expect(page.getByText('10517282990000002',{exact:true})).toBeVisible();await expect(page.getByText('10517282990000003',{exact:true})).toBeVisible();
  await page.getByRole('row').filter({hasText:'10517282990000002'}).getByRole('button',{name:'Fee slip',exact:true}).click();
  await expect(page.getByRole('dialog').getByText('10517282990000002',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Copy consumer number',exact:true})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCSS('opacity','1');await page.screenshot({path:'test-results/bill-installment-fee-slip.png',fullPage:true,animations:'disabled'});
  const [[ledger]]=await pool.query('SELECT SUM(debit-credit) AS balance FROM ledger_entries WHERE tenant_id=?',[tenant]);expect(Number(ledger.balance)).toBe(12000);
});
