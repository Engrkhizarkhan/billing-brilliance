const config = require('../../src/config');
require('../../src/services/disposableDatabaseGuard').assertDisposableDatabase(config, process.env.INTEGRATION_DATABASE_CONFIRM);
const request = require('supertest');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const app = require('../../src/index');
const { pool } = require('../../src/config/database');
const { hashApiKey } = require('../../src/services/apiKeyService');
const { pakistanDate } = require('../../src/services/billingRules');
const fixtures = [];
let school, org, postingId;
const uuid = () => crypto.randomUUID();
async function setup(type, code, length) {
  const tenant = uuid(), user = uuid(), key = uuid();
  fixtures.push({tenant,user});
  await pool.query(`INSERT INTO tenants (id,name,type,biller_code,email,status,lifecycle_stage,consumer_number_length,next_consumer_sequence,api_key_hash,api_key_scope)
    VALUES (?,?,?,?,?,'active','live',?,1,?,'live')`,[tenant,'Flow test',type,code,`${tenant}@example.test`,length,hashApiKey(key)]);
  await pool.query(`INSERT INTO users (id,tenant_id,email,password_hash,name,role,school_access_role,status)
    VALUES (?,?,?,'unused-fixture','Flow test',?,'admin','active')`,[user,tenant,`${user}@example.test`,type]);
  const token = jwt.sign({userId:user,role:type,authVersion:0},config.jwt.secret,{expiresIn:'10m'});
  return {tenant,user,key,call:(method,path,body)=>request(app)[method](path).set('Authorization',`Bearer ${token}`).send(body),
    api:(method,path,body)=>request(app)[method](path).set('X-API-Key',key).send(body)};
}
const provider = (operation,number,body={})=>request(app).post(`/api/1.0/Payments/${operation}`)
  .set({username:config.onebill.username,password:config.onebill.password})
  .send({consumer_number:number,bank_mnemonic:'UBL',reserved:'',...body});
const pay = (number,amount,stan)=>provider('BillPayment',number,{
  transaction_amount:String(Math.round(amount*100)).padStart(12,'0'),tran_auth_id:stan,
  tran_date:new Date().toISOString().slice(0,10).replaceAll('-',''),tran_time:'120000'});
const orgInput = (extra={})=>({applicantId:uuid(),applicationId:uuid(),postingId,customerName:'Ahmed Parent',description:'Annual fees',amount:4600,dueDate:'2099-10-31',neverExpires:true,...extra});
beforeAll(async()=>{
  Object.assign(config.onebill,{username:'flow-test-provider',password:'disposable-test-only'});
  school=await setup('school','8101',14);
  org=await setup('org','8102',24);
  const result=await org.call('post','/api/org/postings',{title:'Admission',type:'entry_test',applicationFee:4600,totalSeats:100,startDate:'2026-01-01',endDate:'2099-10-31',status:'active'});
  expect(result.status).toBe(201);
  postingId=result.body.data.id;
  expect((await org.call('put',`/api/org/postings/${postingId}/status`,{status:'active'})).status).toBe(200);
});
afterAll(async()=>{
  for (const {tenant,user} of fixtures) {
    for (const table of ['notifications','outbox_events','audit_logs','org_payment_notifications','payment_allocations','ledger_entries','transactions','payments','invoices','applicants','org_payment_records','org_postings','students']) {
      await pool.query(`DELETE FROM ${table} WHERE tenant_id = ?`,[tenant]);
    }
    await pool.query('DELETE FROM users WHERE id = ?',[user]);
    await pool.query('DELETE FROM tenants WHERE id = ?',[tenant]);
  }
  await pool.end();
});
test('school dashboard and integration status agree with 1BILL across unbilled, paid and older unpaid invoices',async()=>{
  const created=await school.call('post','/api/students',{name:'School Student',fatherName:'Parent',class:'10',gender:'male',consumerNumber:'forged'});
  expect(created.status).toBe(201);
  const student=created.body.data,number=student.consumer_number;
  expect(number).toMatch(/^1051728101\d{4}$/);
  expect((await provider('BillInquiry',number)).body).toMatchObject({response_Code:'01',bill_status:' '});
  expect((await school.api('post','/api/saas/v1/check-payment',{consumerNumber:number})).body).toMatchObject({paid:false,status:'no_invoices'});
  expect((await pay(number,3200,'829999')).body.response_Code).toBe('01');
  const first=await school.call('post','/api/invoices',{studentId:student.id,amount:3200,lateFee:500,month:'2099-10',dueDate:'2099-10-31'});
  expect(first.status).toBe(201);
  expect(Number(first.body.data.late_fee)).toBe(500);
  expect((await provider('BillInquiry',number.slice(6))).body).toMatchObject({response_Code:'00',bill_status:'U',amount_within_dueDate:'+0000000320000',consumer_Detail:'School Student'.padEnd(30,' ')});
  expect((await pay(number.slice(6),3200,'820001')).body.response_Code).toBe('00');
  expect((await provider('BillInquiry',number)).body).toMatchObject({response_Code:'06',bill_status:'P'});
  expect((await school.api('post','/api/saas/v1/check-payment',{consumerNumber:number})).body.paid).toBe(true);
  const second=await school.call('post','/api/invoices',{studentId:student.id,amount:1500,lateFee:50,month:'2020-09',dueDate:'2020-09-30'});
  expect(second.status).toBe(201);
  const status=await school.api('post','/api/saas/v1/check-payment',{consumerNumber:number});
  expect(status.status).toBe(200);
  expect(status.body).toMatchObject({paid:false,status:'overdue',amount:1550});
  expect((await school.api('get',`/api/saas/v1/bill-status/${number}`)).body).toMatchObject({outstandingAmount:1550,overdueAmount:1550,pendingInvoices:1,paidInvoices:1});
  expect((await provider('BillInquiry',number)).body.amount_after_dueDate).toBe('+0000000155000');
  expect((await pay(number,1500,'820002')).body.response_Code).toBe('02');
  expect((await pay(number,1550,'820003')).body.response_Code).toBe('00');
  expect((await pay(number,1550,'820003')).body.response_Code).toBe('03');
});
test('organization dashboard creates a real collectible overdue bill; paid amount includes fee exactly once',async()=>{
  const input=orgInput({dueDate:'2020-09-30',lateFee:125.50});
  const created=await org.call('post','/api/payments/create',input);
  expect(created.status).toBe(201);
  const bill=created.body.data,number=bill.consumerNumber;
  expect(number).toMatch(/^1051728102\d{14}$/);
  expect(bill.payment.expiry_date).toBe('9999-12-31 23:59:59');
  expect((await org.call('post','/api/payments/create',input)).body.data.consumerNumber).toBe(number);
  const inquiry=(await provider('BillInquiry',number.slice(6))).body;
  expect(inquiry).toMatchObject({response_Code:'00',consumer_Detail:'Ahmed Parent'.padEnd(30,' '),amount_within_dueDate:'+0000000460000',amount_after_dueDate:'+0000000472550'});
  expect((await pay(number,4600,'820004')).body.response_Code).toBe('02');
  expect((await pay(number,4725.5,'820005')).body.response_Code).toBe('00');
  const status=await org.call('get',`/api/payments/${input.applicationId}`);
  expect(status.body.data.status).toBe('paid');
  expect(Number(status.body.data.payment.amount)).toBe(4600);
  expect(Number(status.body.data.payment.paid_amount)).toBe(4725.5);
  expect((await provider('BillInquiry',number)).body).toMatchObject({response_Code:'06',bill_status:'P',amount_paid:'000000472550'});
  expect((await pay(number,4725.5,'820005')).body.response_Code).toBe('03');
});
test.each([0.001,-1,0,10000000000])('rejects organization amount %p without allocating a number',async amount=>{
  const [[before]]=await pool.query('SELECT next_consumer_sequence AS n FROM tenants WHERE id = ?',[org.tenant]);
  expect((await org.call('post','/api/payments/create',orgInput({amount}))).status).toBe(400);
  const [[after]]=await pool.query('SELECT next_consumer_sequence AS n FROM tenants WHERE id = ?',[org.tenant]);
  expect(after.n).toBe(before.n);
});
test('description cannot bypass nonexistent, foreign, or inactive posting validation',async()=>{
  const foreign=await school.call('post','/api/org/postings',{title:'Other tenant',type:'entry_test',applicationFee:10,status:'active'});
  // Insert the cross-tenant fixture if role policy correctly disallows school posting creation.
  const foreignId=foreign.body.data?.id || uuid();
  if(!foreign.body.data?.id) await pool.query("INSERT INTO org_postings (id,tenant_id,title,type,application_fee,status) VALUES (?,?,'Other','entry_test',10,'active')",[foreignId,school.tenant]);
  for(const id of ['missing',foreignId]) expect((await org.call('post','/api/payments/create',orgInput({postingId:id}))).body.code).toBe('POSTING_NOT_FOUND');
  await pool.query("UPDATE org_postings SET status = 'closed' WHERE id = ?",[postingId]);
  try { expect((await org.call('post','/api/payments/create',orgInput())).body.code).toBe('POSTING_NOT_FOUND'); }
  finally { await pool.query("UPDATE org_postings SET status = 'active' WHERE id = ?",[postingId]); }
});
test('API-created due date governs expiry; never-expiring requests keep their due date and fee',async()=>{
  const created=await org.api('post','/api/payments/create',orgInput({neverExpires:false,dueDate:'2099-10-31'}));
  expect(created.status).toBe(201);
  expect(created.body.data.payment.expiry_date).toBe('2099-10-31 18:59:59');
  const today=pakistanDate();
  expect((await org.api('post','/api/payments/create',orgInput({neverExpires:true,dueDate:today,lateFee:-1}))).status).toBe(400);
});
test('legacy applicant creation is retired without issuing unusable numbers',async()=>{
  const result=await org.call('post','/api/applicants',{name:'Applicant',fatherName:'Parent',cnic:'0000000000000',gender:'male',serviceId:postingId});
  expect(result.status).toBe(410);
  expect(result.body.code).toBe('APPLICANT_CREATION_RETIRED');
});
