const config = require('../../src/config');
require('../../src/services/disposableDatabaseGuard').assertDisposableDatabase(config, process.env.INTEGRATION_DATABASE_CONFIRM);
const request = require('supertest');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const app = require('../../src/index');
const {pool} = require('../../src/config/database');
const {hashApiKey} = require('../../src/services/apiKeyService');
const {allocateConsumerNumber} = require('../../src/services/consumerNumberService');
const fixtures=[];
let school,other,stan=910000;
const uuid=()=>crypto.randomUUID();
async function setup(code) {
  const tenant=uuid(), user=uuid(), key=uuid();fixtures.push({tenant,user});
  await pool.query(`INSERT INTO tenants (id,name,type,biller_code,email,status,lifecycle_stage,consumer_number_length,billing_mode,api_key_hash,api_key_scope) VALUES (?,?,'school',?,?,'active','live',17,'invoice',?,'live')`,[tenant,'Installment test',code,`${tenant}@example.test`,hashApiKey(key)]);
  await pool.query(`INSERT INTO users (id,tenant_id,email,password_hash,name,role,school_access_role,status) VALUES (?,?,?,'unused','Fixture','school','admin','active')`,[user,tenant,`${user}@example.test`]);
  const token=jwt.sign({userId:user,role:'school',authVersion:0},config.jwt.secret,{expiresIn:'20m'});
  return {tenant,key,call:(method,path,body)=>request(app)[method](path).set('Authorization',`Bearer ${token}`).send(body),api:(method,path,body)=>request(app)[method](path).set('X-API-Key',key).send(body)};
}
const provider=(action,number,body={})=>request(app).post(`/api/1.0/Payments/${action}`).set({username:config.onebill.username,password:config.onebill.password}).send({consumer_number:number,bank_mnemonic:'UBL',reserved:'',...body});
const inquiry=number=>provider('BillInquiry',number);
const pay=(number,amount,reference=String(++stan))=>provider('BillPayment',number,{transaction_amount:String(Math.round(amount*100)).padStart(12,'0'),tran_auth_id:reference,tran_date:new Date().toISOString().slice(0,10).replaceAll('-',''),tran_time:'120000'});
async function student() {const r=await school.call('post','/api/students',{name:'Installment Student',fatherName:'Parent',class:'University',gender:'male'});expect(r.status).toBe(201);expect(r.body.data.consumer_number).toBeNull();return r.body.data;}
async function bill(s,amount=3000,extra={}) {const r=await school.call('post','/api/invoices',{studentId:s.id,amount,lateFee:0,month:'2099-10',dueDate:'2099-10-31',...extra});expect(r.status).toBe(201);expect(r.body.data.consumer_number).toMatch(/^1051728201\d{7}$/);return r.body.data;}
async function balance(s){const [[r]]=await pool.query('SELECT SUM(debit-credit) AS amount FROM ledger_entries WHERE tenant_id=? AND student_id=?',[school.tenant,s.id]);return Number(r.amount);}
beforeAll(async()=>{Object.assign(config.onebill,{username:'installment-provider',password:'test-only'});school=await setup('8201');other=await setup('8202');});
afterAll(async()=>{for(const {tenant,user} of fixtures){for(const table of ['notifications','outbox_events','audit_logs','payment_allocations','ledger_entries','transactions','payments','invoice_installment_plans','invoice_requests','invoices','payment_plan_assignments','fee_plans','consumer_number_reservations','students'])await pool.query(`DELETE FROM ${table} WHERE tenant_id=?`,[tenant]);await pool.query('DELETE FROM users WHERE id=?',[user]);await pool.query('DELETE FROM tenants WHERE id=?',[tenant]);}await pool.end();});
test('concurrent bills get distinct numbers; paying one never settles the others',async()=>{
  const s=await student(), bills=await Promise.all([bill(s,2000),bill(s,3000),bill(s,4000)]);
  expect(new Set(bills.map(x=>x.consumer_number)).size).toBe(3);
  const number=bills[0].consumer_number;
  const wire=(await inquiry(number.slice(6))).body;
  expect(wire).toMatchObject({response_Code:'00',consumer_Detail:'Installment Student'.padEnd(30,' '),bill_status:'U',amount_within_dueDate:'+0000000200000',date_paid:' '.repeat(8),amount_paid:' '.repeat(12),tran_auth_Id:' '.repeat(6)});
  expect(wire).not.toHaveProperty('consumer_detail');
  for(const amount of [0,1999,2001])expect((await pay(number,amount)).body.response_Code).toBe('02');
  const ref=String(++stan);expect((await pay(number.slice(6),2000,ref)).body.response_Code).toBe('00');
  expect((await pay(number,2000,ref)).body.response_Code).toBe('03');
  expect((await inquiry(number)).body.response_Code).toBe('06');
  expect((await inquiry(bills[1].consumer_number)).body.response_Code).toBe('00');
  expect(await balance(s)).toBe(7000);
  expect((await school.api('post','/api/saas/v1/check-payment',{consumerNumber:number})).body.paid).toBe(true);
  expect((await other.api('post','/api/saas/v1/check-payment',{consumerNumber:number})).body.status).toBe('not_found');
});
test('disabled plans, incorrect sums and foreign invoices cannot alter balances',async()=>{
  const s=await student(), original=await bill(s,10000), parts=[{amount:5000,dueDate:'2099-11-01'},{amount:5000,dueDate:'2099-12-01'}];
  expect((await school.call('post',`/api/invoices/${original.id}/installments`,{installments:parts})).body.code).toBe('INSTALLMENTS_DISABLED');
  expect((await school.call('put','/api/invoices/billing-policy',{installmentsEnabled:true})).status).toBe(200);
  expect((await other.call('put','/api/invoices/billing-policy',{installmentsEnabled:true})).status).toBe(200);
  expect((await other.call('post',`/api/invoices/${original.id}/installments`,{installments:parts})).status).toBe(404);
  expect((await school.call('post',`/api/invoices/${original.id}/installments`,{installments:[...parts.slice(0,1),{...parts[1],amount:4999}]})).body.code).toBe('INSTALLMENT_TOTAL_MISMATCH');
  expect(await balance(s)).toBe(10000);
  const results=await Promise.all([1,2].map(()=>school.call('post',`/api/invoices/${original.id}/installments`,{installments:parts})));
  expect(results.map(x=>x.status).sort()).toEqual([200,201]);
  const children=results[0].body.data.invoices;expect(children).toHaveLength(2);expect(new Set(children.map(x=>x.consumer_number)).size).toBe(2);
  expect(await balance(s)).toBe(10000);
  expect((await inquiry(original.consumer_number)).body).toMatchObject({response_Code:'01',bill_status:' '});
  expect((await pay(original.consumer_number,10000)).body.response_Code).toBe('01');
  expect((await pay(children[0].consumer_number,5000)).body.response_Code).toBe('00');
  expect(await balance(s)).toBe(5000);
  expect((await inquiry(children[1].consumer_number)).body.response_Code).toBe('00');
  expect((await school.call('put','/api/invoices/billing-policy',{installmentsEnabled:false})).status).toBe(200);
  expect((await pay(children[1].consumer_number,5000)).body.response_Code).toBe('00');expect(await balance(s)).toBe(0);
});
test('blocked bills return 02/B and overdue bill applies its own late fee once',async()=>{
  const s=await student(), first=await bill(s,1000,{dueDate:'2020-01-01',lateFee:50}), second=await bill(s,2000,{lateFee:100});
  await pool.query("UPDATE students SET status='inactive' WHERE id=?",[s.id]);
  expect((await inquiry(first.consumer_number)).body).toMatchObject({response_Code:'02',bill_status:'B'});
  expect((await pay(first.consumer_number,1050)).body.response_Code).toBe('02');
  await pool.query("UPDATE students SET status='active' WHERE id=?",[s.id]);
  expect((await inquiry(first.consumer_number)).body).toMatchObject({response_Code:'00',amount_after_dueDate:'+0000000105000'});
  expect((await pay(first.consumer_number,1050)).body.response_Code).toBe('00');expect(await balance(s)).toBe(2000);
  expect((await inquiry(second.consumer_number)).body.amount_after_dueDate).toBe('+0000000210000');
  expect((await pay(second.consumer_number,2100)).body.response_Code).toBe('02');
  expect((await pay(second.consumer_number,2000)).body.response_Code).toBe('00');
});
test('payment racing a split can only collect the original or the replacement bills',async()=>{
  await school.call('put','/api/invoices/billing-policy',{installmentsEnabled:true});
  const s=await student(), original=await bill(s,6000);
  const [payment,split]=await Promise.all([pay(original.consumer_number,6000),school.call('post',`/api/invoices/${original.id}/installments`,{installments:[{amount:3000,dueDate:'2099-11-01'},{amount:3000,dueDate:'2099-12-01'}]})]);
  if(payment.body.response_Code==='00'){expect(split.status).toBe(409);expect(await balance(s)).toBe(0);}
  else{expect(split.status).toBe(201);expect(payment.body.response_Code).toBe('01');expect(await balance(s)).toBe(6000);}
});
test('reserved numbers cannot be recycled even if the tenant counter is accidentally reset',async()=>{
  const s=await student(), original=await bill(s,100);await school.call('delete',`/api/invoices/${original.id}`);
  const [[before]]=await pool.query('SELECT next_consumer_sequence AS n FROM tenants WHERE id=?',[school.tenant]);
  const c=await pool.getConnection();await c.beginTransaction();
  try{await c.query('UPDATE tenants SET next_consumer_sequence=? WHERE id=?',[Number(original.consumer_number.slice(10)),school.tenant]);await expect(allocateConsumerNumber(c,school.tenant)).rejects.toMatchObject({code:'CONSUMER_NUMBER_RESERVED'});}finally{await c.rollback();c.release();}
  const [[after]]=await pool.query('SELECT next_consumer_sequence AS n FROM tenants WHERE id=?',[school.tenant]);expect(after.n).toBe(before.n);
});
test('integration bill creation retries are idempotent and scope stays with its institution',async()=>{
  const s=await student(), payload={studentId:s.id,amount:1234,lateFee:0,dueDate:'2099-11-01'};
  const issue=body=>school.api('post','/api/saas/v1/bills',body).set('X-Idempotency-Key','invoice-once');
  const results=await Promise.all([issue(payload),issue(payload)]);
  expect(results.map(x=>x.status).sort()).toEqual([200,201]);
  expect(results[0].body.data.id).toBe(results[1].body.data.id);expect(await balance(s)).toBe(1234);
  expect((await issue({...payload,amount:1235})).status).toBe(409);
  expect((await other.api('post','/api/saas/v1/bills',payload).set('X-Idempotency-Key','foreign')).status).toBe(404);
  expect((await school.api('post',`/api/saas/v1/bills/${results[0].body.data.id}/installments`,{installments:[{amount:600,dueDate:'2099-11-01'},{amount:634,dueDate:'2099-12-01'}]})).status).toBe(201);
  expect(await balance(s)).toBe(1234);
});
test('monthly fee generation respects a split bill and never recharges transport',async()=>{
  const s=await student(),plan=uuid(),assignment=uuid();
  await pool.query("UPDATE students SET uses_bus_service=1,bus_service_start_month='2099-10',bus_monthly_fee=100 WHERE id=?",[s.id]);
  await pool.query("INSERT INTO fee_plans (id,tenant_id,name,amount,due_day,frequency,plan_type) VALUES (?,?,'Monthly',2000,10,'monthly','tuition')",[plan,school.tenant]);
  await pool.query("INSERT INTO payment_plan_assignments (id,tenant_id,student_id,fee_plan_id,assigned_date,next_due_date,status) VALUES (?,?,?,?,'2099-10-01','2099-10-10','active')",[assignment,school.tenant,s.id,plan]);
  expect((await school.call('post','/api/invoices/generate',{month:'2099-10'})).status).toBe(200);
  const [[original]]=await pool.query('SELECT * FROM invoices WHERE tenant_id=? AND student_id=?',[school.tenant,s.id]);expect(Number(original.amount)).toBe(2100);
  expect((await school.call('post',`/api/invoices/${original.id}/installments`,{installments:[{amount:1000,dueDate:'2099-10-10'},{amount:1100,dueDate:'2099-11-10'}]})).status).toBe(201);
  const repeat=await school.call('post','/api/invoices/generate',{month:'2099-10'});expect(repeat.body.data.created).toBe(0);expect(await balance(s)).toBe(2100);
  expect((await school.call('post','/api/invoices/generate',{month:'2099-11'})).body.data.created).toBe(1);expect(await balance(s)).toBe(4200);
});
test('failure creating installment charges rolls back retirement and all new numbers',async()=>{
  const s=await student(),original=await bill(s,1000),trigger=`split_fail_${crypto.randomBytes(5).toString('hex')}`;
  const [[before]]=await pool.query('SELECT next_consumer_sequence AS n FROM tenants WHERE id=?',[school.tenant]);
  await pool.query(`CREATE TRIGGER ${trigger} BEFORE INSERT ON ledger_entries FOR EACH ROW BEGIN IF NEW.tenant_id='${school.tenant}' AND NEW.description LIKE 'Installment %' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected installment failure'; END IF; END`);
  try{expect((await school.call('post',`/api/invoices/${original.id}/installments`,{installments:[{amount:500,dueDate:'2099-11-01'},{amount:500,dueDate:'2099-12-01'}]})).status).toBe(500);}finally{await pool.query(`DROP TRIGGER ${trigger}`);}
  expect((await inquiry(original.consumer_number)).body.response_Code).toBe('00');expect(await balance(s)).toBe(1000);
  const [[after]]=await pool.query('SELECT next_consumer_sequence AS n FROM tenants WHERE id=?',[school.tenant]);expect(after.n).toBe(before.n);
  const [[plans]]=await pool.query('SELECT COUNT(*) n FROM invoice_installment_plans WHERE original_invoice_id=?',[original.id]);expect(plans.n).toBe(0);
});
test('bill inquiry works in an isolated institution sandbox while production rejects testing tenants',async()=>{
  const s=await student(),b=await bill(s,2000),{readInvoiceConsumer}=require('../../src/services/invoiceConsumerService');
  await pool.query("UPDATE tenants SET lifecycle_stage='testing' WHERE id=?",[school.tenant]);
  const originalEnvironment=config.appEnvironment;
  try{expect((await readInvoiceConsumer(b.consumer_number,school.tenant)).code).toBe('01');config.appEnvironment='sandbox';expect((await readInvoiceConsumer(b.consumer_number,school.tenant)).code).toBe('00');}
  finally{config.appEnvironment=originalEnvironment;await pool.query("UPDATE tenants SET lifecycle_stage='live' WHERE id=?",[school.tenant]);}
});
