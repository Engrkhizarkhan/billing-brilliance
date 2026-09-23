const config = require('../../src/config');
const { assertDisposableDatabase } = require('../../src/services/disposableDatabaseGuard');
// Refuse accidental execution against an operator's configured database.
assertDisposableDatabase(config, process.env.INTEGRATION_DATABASE_CONFIRM);
const request = require('supertest');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../../src/index');
const { pool } = require('../../src/config/database');
const { lockBillingTenant, createInvoiceCharges } = require('../../src/services/invoiceAccountingService');
const { postPayment, reverseManualPayment } = require('../../src/services/paymentPostingService');
const { replacePassword } = require('../../src/services/sessionService');

let tenantId, studentId, userId, token, consumerNumber;
const uuid = () => crypto.randomUUID();
const password = 'Regression-Only-Password!2026';
const tenantRequest = (method, path) => request(app)[method](path).set('Authorization', `Bearer ${token}`).set('X-Tenant-Id', tenantId);
const charge = async (amount = 100, options = {}) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await lockBillingTenant(connection, tenantId);
    const [invoice] = await createInvoiceCharges(connection, tenantId, [{ studentId, amount, month: '2026-09', dueDate: '2099-09-30', ...options }]);
    await connection.commit();
    return invoice;
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
};
const payment = (amount = 100, options = {}) => ({ tenantId, studentId, consumerNumber, amount,
  source: 'manual', targetType: 'invoice', externalReference: uuid(), idempotencyKey: uuid(),
  channel: 'counter', note: 'Verified regression fixture', ...options });

beforeEach(async () => {
  tenantId = uuid(); studentId = uuid(); userId = uuid();
  const code = `T${crypto.randomBytes(5).toString('hex')}`;
  consumerNumber = `105172${String(crypto.randomInt(1000,9999))}${String(crypto.randomInt(100000000,999999999)).padStart(14,'0')}`;
  await pool.query("INSERT INTO tenants (id,name,type,biller_code,email,status,lifecycle_stage) VALUES (?, 'Regression School','school',?,?,'active','live')", [tenantId, code, `${tenantId}@example.test`]);
  await pool.query("INSERT INTO students (id,tenant_id,name,father_name,class,consumer_number,bill_id,status) VALUES (?,?,'Student','Parent','12',?,?,'active')", [studentId,tenantId,consumerNumber,uuid()]);
  await pool.query("INSERT INTO users (id,email,password_hash,name,role,status) VALUES (?,?,?,'Test Admin','admin','active')", [userId,`${userId}@example.test`,await bcrypt.hash(password, 4)]);
  token = jwt.sign({ userId, role: 'admin', authVersion: 0 },config.jwt.secret,{ expiresIn:'5m' });
});
afterEach(async () => {
  // Only this test's UUID-scoped fixtures are removed; never truncate shared data.
  for (const table of ['notifications','outbox_events','audit_logs','org_payment_notifications','payment_allocations','ledger_entries','transactions','payments','invoices','student_scholarship_assignments','scholarships','payment_plan_assignments','fee_plans','org_payment_records','students']) {
    await pool.query(`DELETE FROM ${table} WHERE tenant_id = ?`,[tenantId]);
  }
  await pool.query('DELETE FROM notifications WHERE user_id = ?',[userId]);
  await pool.query('DELETE FROM audit_logs WHERE user_id = ?',[userId]);
  await pool.query('DELETE FROM refresh_tokens WHERE user_id = ?',[userId]);
  await pool.query('DELETE FROM users WHERE id = ?',[userId]);
  await pool.query('DELETE FROM tenants WHERE id = ?',[tenantId]);
});
afterAll(() => pool.end());

test('invoice, ledger and cached balance commit together; cancellation compensates the charge',async () => {
  const created = await tenantRequest('post','/api/invoices').send({studentId,studentName:'FORGED',consumerNumber:'FORGED',month:'2026-09',amount:123.45,dueDate:'2099-09-30'});
  expect(created.status).toBe(201);
  expect(created.body.data.student_name).toBe('Student');
  const [[ledger]] = await pool.query('SELECT SUM(debit-credit) AS balance FROM ledger_entries WHERE student_id = ?',[studentId]);
  expect(Number(ledger.balance)).toBe(123.45);
  const cancelled = await tenantRequest('delete',`/api/invoices/${created.body.data.id}`);
  expect(cancelled.status).toBe(200);
  const [[student]] = await pool.query('SELECT balance FROM students WHERE id = ?',[studentId]);
  expect(Number(student.balance)).toBe(0);
});

test('concurrent duplicate callbacks create exactly one accounting bundle',async () => {
  await charge();
  const input = payment();
  const results = await Promise.allSettled(Array.from({length:8},()=>postPayment(input)));
  expect(results.filter(r=>r.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter(r=>r.status === 'rejected').every(r=>r.reason.code === 'DUPLICATE_PAYMENT')).toBe(true);
  for (const table of ['payments','payment_allocations','transactions','outbox_events']) {
    const [[row]] = await pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE tenant_id = ?`,[tenantId]);
    expect(row.n).toBe(1);
  }
  const [[student]] = await pool.query('SELECT balance FROM students WHERE id = ?',[studentId]);
  expect(Number(student.balance)).toBe(0);
});

test('database failure after invoice settlement rolls back every financial write',async () => {
  const invoice = await charge();
  const trigger = `test_fail_${crypto.randomBytes(6).toString('hex')}`;
  await pool.query(`CREATE TRIGGER ${trigger} BEFORE INSERT ON audit_logs FOR EACH ROW BEGIN
    IF NEW.tenant_id = '${tenantId}' AND NEW.action = 'payment' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Injected audit failure'; END IF; END`);
  try { await expect(postPayment(payment())).rejects.toMatchObject({ sqlState: '45000' }); }
  finally { await pool.query(`DROP TRIGGER ${trigger}`); }
  const [[stored]] = await pool.query('SELECT status FROM invoices WHERE id = ?',[invoice.id]);
  expect(stored.status).toBe('pending');
  for (const table of ['payments','payment_allocations','transactions','outbox_events']) {
    const [[row]] = await pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE tenant_id = ?`,[tenantId]);
    expect(row.n).toBe(0);
  }
});

test('settled invoice cannot be reopened through status editing, and reversal restores its balance',async () => {
  const invoice = await charge();
  const posted = await postPayment(payment());
  const response = await tenantRequest('put',`/api/invoices/${invoice.id}/status`).send({status:'pending'});
  expect(response.status).toBe(409);
  await reverseManualPayment({tenantId,paymentId:posted.paymentId,reason:'Duplicate bank evidence corrected',confirmation:posted.receiptNumber});
  const [[student]] = await pool.query('SELECT balance FROM students WHERE id = ?',[studentId]);
  expect(Number(student.balance)).toBe(100);
  const analytics = await tenantRequest('get','/api/reports/platform-analytics');
  expect(analytics.status).toBe(200);
  expect(analytics.body.data.tenantSummary.find(t=>t.id===tenantId).revenue).toBe(0);
});

test('testing tenants cannot create charges or use a simulator source to bypass activation',async () => {
  await pool.query("UPDATE tenants SET lifecycle_stage = 'testing' WHERE id = ?",[tenantId]);
  await expect(charge()).rejects.toMatchObject({code:'TENANT_NOT_LIVE'});
  await expect(postPayment(payment(100,{source:'sandbox_simulator'}))).rejects.toMatchObject({code:'TENANT_NOT_LIVE'});
});

test('quarterly assignments bill only their due cycle and ignore inactive/future scholarships',async () => {
  const planId=uuid();
  await pool.query("INSERT INTO fee_plans (id,tenant_id,name,amount,due_day,frequency,plan_type) VALUES (?,?,'Quarterly',900,15,'quarterly','tuition')",[planId,tenantId]);
  await pool.query("INSERT INTO payment_plan_assignments (id,tenant_id,student_id,fee_plan_id,assigned_date,next_due_date,status) VALUES (?,?,?,?,'2026-01-01','2026-01-15','active')",[uuid(),tenantId,studentId,planId]);
  for (const [status,effective] of [['inactive','2026-01-01'],['active','2026-11-01']]) {
    const id=uuid();
    await pool.query("INSERT INTO scholarships (id,tenant_id,name,type,value,is_lifetime,status,start_date) VALUES (?,?,'Test','percentage',50,1,?,'2026-01-01')",[id,tenantId,status]);
    await pool.query("INSERT INTO student_scholarship_assignments (id,tenant_id,student_id,scholarship_id,status,effective_from) VALUES (?,?,?,?,'active',?)",[uuid(),tenantId,studentId,id,effective]);
  }
  const off = await tenantRequest('post','/api/invoices/generate').send({month:'2026-09'});
  expect(off.status).toBe(200); expect(off.body.data.created).toBe(0);
  const due = await tenantRequest('post','/api/invoices/generate').send({month:'2026-10'});
  expect(due.status).toBe(200); expect(due.body.data.created).toBe(1);
  const [[invoice]] = await pool.query('SELECT amount FROM invoices WHERE tenant_id = ?',[tenantId]);
  expect(Number(invoice.amount)).toBe(900);
  const retry = await tenantRequest('post','/api/invoices/generate').send({month:'2026-10'});
  expect(retry.body.data.created).toBe(0);
});

test('refresh tokens are unique, rotate only once concurrently, and password reset revokes access',async () => {
  const login = () => request(app).post('/api/auth/login').send({email:`${userId}@example.test`,password});
  const logins = await Promise.all([login(),login()]);
  expect(logins.map(r=>r.status)).toEqual([200,200]);
  const cookies=logins.map(r=>r.headers['set-cookie'][0].split(';')[0]);
  expect(cookies[0]).not.toBe(cookies[1]);
  const refreshed=await Promise.all([0,1].map(()=>request(app).post('/api/auth/refresh').set('Cookie',cookies[0]).send({})));
  expect(refreshed.map(r=>r.status).sort()).toEqual([200,401]);
  await replacePassword(userId,await bcrypt.hash('Replacement-Password!2026',4));
  expect((await tenantRequest('get','/api/auth/profile')).status).toBe(401);
  expect((await request(app).post('/api/auth/refresh').set('Cookie',cookies[1]).send({})).status).toBe(401);
});

test('aggregate totals include invoices beyond a display page and tenant summaries are paginated',async () => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction(); await lockBillingTenant(connection,tenantId);
    await createInvoiceCharges(connection,tenantId,Array.from({length:105},()=>({studentId,amount:10,month:'2026-09',dueDate:'2099-09-30'})));
    await connection.commit();
  } finally { connection.release(); }
  const response = await tenantRequest('get','/api/reports/platform-analytics?pageSize=100');
  expect(response.status).toBe(200);
  expect(response.body.data.tenantSummary.find(t=>t.id===tenantId)).toMatchObject({invoiceCount:105,pendingAmount:1050});
});

test('organization reversal and replacement payment still produce one list row',async () => {
  const id=uuid(), billId=uuid();
  await pool.query("INSERT INTO org_payment_records (id,tenant_id,application_id,applicant_id,posting_id,bill_id,consumer_number,amount,status,due_date,expiry_date,customer_name) VALUES (?,?,?,?,?,?,?,100,'pending','2099-09-30','2099-10-01 00:00:00','Customer')",[id,tenantId,uuid(),uuid(),uuid(),billId,consumerNumber]);
  const first=await postPayment(payment(100,{targetType:'org_payment',orgPaymentId:id}));
  await reverseManualPayment({tenantId,paymentId:first.paymentId,reason:'Correct duplicate verification',confirmation:first.receiptNumber});
  await postPayment(payment(100,{targetType:'org_payment',orgPaymentId:id}));
  const listed=await tenantRequest('get','/api/payments');
  expect(listed.status).toBe(200);
  expect(listed.body.meta.total).toBe(1);
  expect(listed.body.data).toHaveLength(1);
  expect(listed.body.data[0].status).toBe('paid');
  const [events]=await pool.query("SELECT payload FROM outbox_events WHERE tenant_id=? AND event_type='payment.posted'",[tenantId]);
  const payload=typeof events[0].payload === 'string' ? JSON.parse(events[0].payload) : events[0].payload;
  expect(payload).toMatchObject({billId,targetId:id,targetType:'org_payment'});
  expect(payload.applicationId).toBeTruthy();
});

test('API-key allowlist applies to payment lists, notifications and SaaS routes',async () => {
  const { generateApiKey }=require('../../src/services/apiKeyService');
  const key=generateApiKey();
  await pool.query('UPDATE tenants SET api_key_hash=?,api_key_scope=? WHERE id=?',[key.hash,key.scope,tenantId]);
  await pool.query('INSERT INTO settings (id,tenant_id,`key`,value) VALUES (?,?,?,?)',[uuid(),tenantId,'org_security_context',JSON.stringify({sourceIp:['10.1.2.3']})]);
  try {
    for (const path of ['/api/payments','/api/payment-notifications',`/api/saas/v1/bill-status/${consumerNumber}`]) {
      const response=await request(app).get(path).set('X-API-Key',key.secret);
      expect(response.status).toBe(403); expect(response.body.code).toBe('IP_BLOCKED');
    }
  } finally { await pool.query('DELETE FROM settings WHERE tenant_id=?',[tenantId]); }
});

test('school finance users cannot post a self-reported payment through the legacy route',async () => {
  await pool.query("UPDATE users SET role='school', tenant_id=?, school_access_role='finance' WHERE id=?",[tenantId,userId]);
  const response=await tenantRequest('post','/api/billing/payment').send({consumerNumber,amount:100,transactionId:uuid()});
  expect(response.status).toBe(403); expect(response.body.code).toBe('VERIFIED_PAYMENT_REQUIRED');
});

test('an additional assignment rolls back if its ledger insert fails',async () => {
  const planId=uuid();
  await pool.query("INSERT INTO fee_plans (id,tenant_id,name,amount,due_day,frequency,plan_type) VALUES (?,?,'Service',50,1,'monthly','additional')",[planId,tenantId]);
  const trigger=`test_charge_${crypto.randomBytes(6).toString('hex')}`;
  await pool.query(`CREATE TRIGGER ${trigger} BEFORE INSERT ON ledger_entries FOR EACH ROW BEGIN IF NEW.tenant_id='${tenantId}' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected charge failure'; END IF; END`);
  try {
    const response=await tenantRequest('post','/api/payment-plan-assignments').send({studentId,feePlanId:planId,assignedDate:'2026-09-01'});
    expect(response.status).toBe(500);
    for(const table of ['payment_plan_assignments','invoices','ledger_entries']) {
      const [[row]]=await pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE tenant_id=?`,[tenantId]); expect(row.n).toBe(0);
    }
    const [[student]]=await pool.query('SELECT balance FROM students WHERE id=?',[studentId]); expect(Number(student.balance)).toBe(0);
  } finally { await pool.query(`DROP TRIGGER ${trigger}`); }
});

test('legacy invoice with missing charge evidence cannot silently create a negative ledger balance',async () => {
  await pool.query("INSERT INTO invoices (id,tenant_id,invoice_number,student_id,student_name,consumer_number,amount,status,due_date) VALUES (?,?,?,?,'Student',?,100,'pending','2099-09-30')",[uuid(),tenantId,'INV-LEGACY',studentId,consumerNumber]);
  await expect(postPayment(payment())).rejects.toMatchObject({code:'LEDGER_RECONCILIATION_REQUIRED'});
  const inquiry=await tenantRequest('post','/api/manual-payments/inquiry').send({consumerNumber});
  expect(inquiry.status).toBe(200); expect(inquiry.body.data.payable).toBe(false);
  expect(inquiry.body.data.reason).toContain('reconciliation');
});

test('profile editing cannot bypass ledger-controlled student balances',async () => {
  const response=await tenantRequest('put',`/api/students/${studentId}`).send({balance:999});
  expect(response.status).toBe(409); expect(response.body.code).toBe('BALANCE_IMMUTABLE');
  const [[student]]=await pool.query('SELECT balance FROM students WHERE id=?',[studentId]); expect(Number(student.balance)).toBe(0);
});

test('transport billing does not require a tuition assignment and is idempotent within its month',async () => {
  await pool.query("UPDATE students SET uses_bus_service=1,bus_service_start_month='2026-09',bus_monthly_fee=150 WHERE id=?",[studentId]);
  const first=await tenantRequest('post','/api/invoices/generate').send({month:'2026-09'});
  expect(first.status).toBe(200); expect(first.body.data.created).toBe(1);
  const second=await tenantRequest('post','/api/invoices/generate').send({month:'2026-09'});
  expect(second.body.data.created).toBe(0);
  const [[student]]=await pool.query('SELECT balance FROM students WHERE id=?',[studentId]); expect(Number(student.balance)).toBe(150);
});

const onebillCredentials = { username:'isolated-provider-test', password:'isolated-provider-password' };
const providerRequest = (operation, body, credentials=onebillCredentials) => request(app)
  .post(`/api/1.0/Payments/${operation}`).set(credentials).send({consumer_number:consumerNumber,bank_mnemonic:'UBL',reserved:'',...body});
const providerPayment = (overrides={}) => ({tran_auth_id:'123456',transaction_amount:'000000010000',tran_date:'20260923',tran_time:'123456',...overrides});

test('1BILL exact payment, concurrent replay, paid inquiry and already-paid rejection preserve one accounting bundle',async()=>{
  Object.assign(config.onebill,onebillCredentials);
  await charge();
  const inquiry=await providerRequest('BillInquiry',{});
  expect(inquiry.body).toMatchObject({response_Code:'00',bill_status:'U',amount_within_dueDate:'+0000000010000',due_date:'20990930',billing_month:'2609'});
  expect(inquiry.body.consumer_detail).toHaveLength(30);
  const payments=await Promise.all(Array.from({length:6},()=>providerRequest('BillPayment',providerPayment())));
  expect(payments.filter(r=>r.body.response_Code==='00')).toHaveLength(1);
  expect(payments.filter(r=>r.body.response_Code==='03')).toHaveLength(5);
  expect((await providerRequest('BillInquiry',{})).body).toMatchObject({response_Code:'00',bill_status:'P',date_paid:'20260923',amount_paid:'000000010000',tran_auth_Id:'123456'});
  expect((await providerRequest('BillPayment',providerPayment({tran_auth_id:'123457'}))).body.response_Code).toBe('06');
  for(const table of ['payments','transactions','payment_allocations','outbox_events']){
    const [[r]]=await pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE tenant_id=?`,[tenantId]);expect(r.n).toBe(1);
  }
});

test('1BILL invalid credentials, amounts, calendar dates and malformed fields cannot record payment',async()=>{
  Object.assign(config.onebill,onebillCredentials);
  await charge();
  expect((await providerRequest('BillInquiry',{}, {username:'wrong',password:'wrong'})).status).toBe(401);
  for(const body of [providerPayment({transaction_amount:'000000009999'}),providerPayment({transaction_amount:'000000010001'}),providerPayment({tran_date:'20260230'}),providerPayment({tran_time:'240000'}),providerPayment({tran_auth_id:'12345'}),providerPayment({bank_mnemonic:'TOO-LONG-MNEMONIC'}),providerPayment({consumer_number:'1'.repeat(25)})]){
    expect((await providerRequest('BillPayment',body)).body.response_Code).toBe('04');
  }
  expect((await providerRequest('BillInquiry',{consumer_number:'1'.repeat(20)})).body.response_Code).toBe('01');
  const [[r]]=await pool.query('SELECT COUNT(*) AS n FROM payments WHERE tenant_id=?',[tenantId]);expect(r.n).toBe(0);
});

test('1BILL blocked consumer cannot pay and overdue payment must include the quoted late fee',async()=>{
  Object.assign(config.onebill,onebillCredentials);
  await charge(100,{dueDate:'2020-01-01',lateFee:25});
  // Set persisted late fee explicitly to exercise the provider quote independently of charge defaults.
  await pool.query('UPDATE invoices SET late_fee=25 WHERE tenant_id=?',[tenantId]);
  await pool.query("UPDATE students SET status='inactive' WHERE id=?",[studentId]);
  expect((await providerRequest('BillInquiry',{})).body).toMatchObject({response_Code:'02',bill_status:'B'});
  expect((await providerRequest('BillPayment',providerPayment())).body.response_Code).toBe('01');
  await pool.query("UPDATE students SET status='active' WHERE id=?",[studentId]);
  expect((await providerRequest('BillInquiry',{})).body).toMatchObject({amount_within_dueDate:'+0000000010000',amount_after_dueDate:'+0000000012500'});
  expect((await providerRequest('BillPayment',providerPayment())).body.response_Code).toBe('04');
  expect((await providerRequest('BillPayment',providerPayment({transaction_amount:'000000012500'}))).body.response_Code).toBe('00');
  const [[r]]=await pool.query('SELECT balance FROM students WHERE id=?',[studentId]);expect(Number(r.balance)).toBe(0);
});

test('1BILL production source restriction rejects forged forwarding headers from an untrusted direct caller',async()=>{
  Object.assign(config.onebill,onebillCredentials);
  const previous=config.nodeEnv,ips=config.onebill.allowedIps;
  config.nodeEnv='production';config.onebill.allowedIps=['10.95.8.92','10.95.8.94'];
  try {
    const r=await request(app).post('/api/1.0/Payments/BillInquiry').set(onebillCredentials).set('X-Forwarded-For','10.95.8.92').send({consumer_number:consumerNumber,bank_mnemonic:'UBL'});
    expect(r.status).toBe(401);
  } finally {config.nodeEnv=previous;config.onebill.allowedIps=ips;}
});

test('legacy charge restoration requires the exact reviewed plan, preserves payment and is idempotent',async()=>{
  const {restoreMissingInvoiceCharges}=require('../../src/operations/restoreMissingInvoiceCharges');
  await charge();
  const posted=await postPayment(payment());
  await pool.query("DELETE FROM ledger_entries WHERE tenant_id=? AND entry_type='charge'",[tenantId]);
  const plan=await restoreMissingInvoiceCharges();
  expect(plan.plan.find(i=>i.tenant_id===tenantId).resultingBalance).toBe(0);
  await expect(restoreMissingInvoiceCharges({applyHash:'wrong',databaseConfirmation:config.db.database})).rejects.toThrow('Plan or database changed');
  await restoreMissingInvoiceCharges({applyHash:plan.planHash,databaseConfirmation:config.db.database});
  const [[p]]=await pool.query('SELECT status FROM payments WHERE id=?',[posted.paymentId]);expect(p.status).toBe('posted');
  const [[l]]=await pool.query('SELECT SUM(debit-credit) balance FROM ledger_entries WHERE tenant_id=?',[tenantId]);expect(Number(l.balance)).toBe(0);
  expect((await restoreMissingInvoiceCharges()).plan.some(i=>i.tenant_id===tenantId)).toBe(false);
});

test('legacy charge restoration refuses ambiguous pre-existing debit entries',async()=>{
  const {restoreMissingInvoiceCharges}=require('../../src/operations/restoreMissingInvoiceCharges');
  await charge();
  await pool.query("UPDATE ledger_entries SET entry_type='adjustment' WHERE tenant_id=?",[tenantId]);
  await expect(restoreMissingInvoiceCharges()).rejects.toThrow('Ambiguous ledger/payment evidence');
});

test('1BILL expired organization bill cannot be paid',async()=>{
  Object.assign(config.onebill,onebillCredentials);
  await pool.query('DELETE FROM students WHERE id=?',[studentId]);
  await pool.query("INSERT INTO org_payment_records (id,tenant_id,application_id,applicant_id,posting_id,bill_id,consumer_number,amount,status,due_date,expiry_date) VALUES (?,?,?,?,?,?,?,100,'pending','2020-01-01','2020-01-02 00:00:00')",[uuid(),tenantId,uuid(),uuid(),uuid(),uuid(),consumerNumber]);
  expect((await providerRequest('BillInquiry',{})).body.response_Code).toBe('01');
  expect((await providerRequest('BillPayment',providerPayment())).body.response_Code).toBe('01');
  const [[r]]=await pool.query('SELECT COUNT(*) n FROM payments WHERE tenant_id=?',[tenantId]);expect(r.n).toBe(0);
});

test.each([14,20,24])('1BILL supports an existing %i digit consumer without truncation',async(length)=>{
  Object.assign(config.onebill,onebillCredentials);
  consumerNumber=consumerNumber.slice(0,length);
  await pool.query('UPDATE students SET consumer_number=? WHERE id=?',[consumerNumber,studentId]);
  await charge();
  expect((await providerRequest('BillInquiry',{})).body.response_Code).toBe('00');
});
