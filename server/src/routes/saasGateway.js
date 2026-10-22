const {readInvoiceConsumer}=require('../services/invoiceConsumerService');
/** Tenant-scoped external billing APIs. FetchBundle/PCID coupling is retired. */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const config = require('../config');
const logger = require('../config/logger');
const { allocateStudentIdentity } = require('../services/consumerNumberService');
const { postPayment } = require('../services/paymentPostingService');
const { assertMoney, payableQuote, money, dueDayEnd } = require('../services/billingRules');
const { hashApiKey } = require('../services/apiKeyService');

const { lockBillingTenant, createInvoiceCharges } = require('../services/invoiceAccountingService');
const { assertIntegrationPolicy } = require('../services/integrationPolicy');
const router = express.Router();
const expectedApiKeyScope = config.appEnvironment === 'sandbox' ? 'test' : 'live';

const apiKeyAuth = async (req, res, next) => {
  const apiKey = String(req.headers['x-api-key'] || '');
  if (!apiKey) return res.status(401).json({ error: 'Missing X-API-Key header', code: 'MISSING_API_KEY' });
  try {
    const [rows] = await pool.query(
      `SELECT id, name, status, lifecycle_stage FROM tenants
       WHERE api_key_hash = ? AND api_key_scope = ? AND deleted_at IS NULL LIMIT 1`,
      [hashApiKey(apiKey), expectedApiKeyScope]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid API key', code: 'INVALID_API_KEY' });
    const tenant = rows[0];
    if (tenant.status !== 'active') return res.status(403).json({ error: 'Biller is suspended', code: 'TENANT_SUSPENDED' });
    if (config.appEnvironment !== 'sandbox' && tenant.lifecycle_stage !== 'live') {
      return res.status(403).json({ error: 'Biller is not active in production', code: 'TENANT_NOT_LIVE' });
    }
    await assertIntegrationPolicy(req, tenant.id);
    req.saasTenantId = tenant.id;
    req.saasTenant = tenant;
    next();
  } catch (err) {
    logger.error('SaaS API key auth error:', err);
    next(err);
  }
};

router.use(apiKeyAuth);

const findStudent = async (tenantId, consumerNumber) => {
  const [rows] = await pool.query(
    `SELECT id, name, class, consumer_number FROM students
     WHERE NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id=students.tenant_id AND t.billing_mode='invoice') AND tenant_id = ? AND consumer_number = ? AND status = 'active'
       AND deleted_at IS NULL LIMIT 1`,
    [tenantId, consumerNumber]
  );
  return rows[0] || null;
};

// Read the complete balance using the same calculation as 1BILL inquiry.
const schoolBilling = async (tenantId, studentId) => {
  const [invoices] = await pool.query(
    `SELECT invoice_number, amount, status, due_date, late_fee, late_fee_applied FROM invoices
     WHERE tenant_id = ? AND student_id = ? AND deleted_at IS NULL ORDER BY due_date ASC, created_at ASC`, [tenantId, studentId]);
  const [[ledger]] = await pool.query(
    `SELECT COALESCE(SUM(debit),0) AS debit, COALESCE(SUM(credit),0) AS credit
     FROM ledger_entries WHERE tenant_id = ? AND student_id = ?`, [tenantId, studentId]);
  const pending = invoices.filter(row => row.status !== 'paid');
  const quote = payableQuote(pending, ledger);
  const overdue = pending.filter(row => dueDayEnd(row.due_date) < new Date());
  return { invoices, pending, quote, overdueAmount: money(payableQuote(overdue, {}, new Date(), true).amount) };
};

router.post('/check-payment', async (req, res, next) => {
  try {
    const consumerNumber = String(req.body.consumerNumber || '').trim();
    if (!/^\d{1,24}$/.test(consumerNumber)) return res.status(400).json({ error: 'Valid consumerNumber is required', code: 'INVALID_PARAM' });
    if(consumerNumber.length===17){
      const bill=await readInvoiceConsumer(consumerNumber,req.saasTenantId);
      if(bill.record) return res.json({consumerNumber,studentId:bill.record.student_id,name:bill.record.student_name,invoiceNumber:bill.record.invoice_number,
        paid:bill.code==='06',status:bill.code==='06'?'paid':bill.code==='02'?'blocked':bill.code==='00'?'pending':'unavailable',amount:bill.quote?.amount||0,dueDate:bill.record.due_date});
    }
    const student = await findStudent(req.saasTenantId, consumerNumber);
    if (!student) return res.json({ paid: false, status: 'not_found', consumerNumber });
    const { invoices, pending, quote } = await schoolBilling(req.saasTenantId, student.id);
    const invoice = pending[0] || invoices[invoices.length - 1];
    if (!invoice && quote.amount === 0) return res.json({ paid: false, status: 'no_invoices', consumerNumber, name: student.name });
    const [payments] = await pool.query(
      `SELECT amount, received_at AS paidAt, reference AS transactionId FROM payments
       WHERE tenant_id = ? AND student_id = ? AND status = 'posted' AND reversal_of_payment_id IS NULL
       ORDER BY received_at DESC, created_at DESC LIMIT 1`, [req.saasTenantId, student.id]
    );
    const reconciled = quote.ledgerDue >= quote.invoiceDue;
    const paid = quote.amount === 0 && pending.length === 0;
    const status = !reconciled ? 'reconciliation_required' : paid ? 'paid'
      : pending.some(row => dueDayEnd(row.due_date) < new Date()) ? 'overdue' : 'pending';
    res.json({ paid: reconciled && paid, status, consumerNumber,
      name: student.name, invoiceNumber: invoice?.invoice_number || null, amount: quote.amount,
      dueDate: invoice?.due_date || null, lastPayment: payments[0] || null });
  } catch (err) { next(err); }
});

router.get('/bill-status/:consumerNumber', async (req, res, next) => {
  try {
    const consumerNumber = String(req.params.consumerNumber || '').trim();
    if(consumerNumber.length===17){
      const bill=await readInvoiceConsumer(consumerNumber,req.saasTenantId);
      if(bill.record) return res.json({consumerNumber,name:bill.record.student_name,studentId:bill.record.student_id,invoiceNumber:bill.record.invoice_number,
        totalInvoices:1,paidInvoices:bill.code==='06'?1:0,pendingInvoices:bill.code==='00'?1:0,outstandingAmount:bill.quote?.amount||0,
        overdueAmount:dueDayEnd(bill.record.due_date)<new Date()?(bill.quote?.amount||0):0,payable:bill.code==='00'});
    }
    const student = await findStudent(req.saasTenantId, consumerNumber);
    if (!student) return res.status(404).json({ error: 'Consumer not found', code: 'NOT_FOUND' });
    const { invoices, pending, quote, overdueAmount } = await schoolBilling(req.saasTenantId, student.id);
    res.json({ consumerNumber, name: student.name, class: student.class,
      totalInvoices: invoices.length, paidInvoices: invoices.length - pending.length,
      pendingInvoices: pending.length, outstandingAmount: quote.amount, overdueAmount,
      reconciled: quote.ledgerDue >= quote.invoiceDue });
  } catch (err) { next(err); }
});

router.get('/payment-history/:consumerNumber', async (req, res, next) => {
  try {
    const consumerNumber = String(req.params.consumerNumber || '').trim();
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 25, 1), 100);
    if(consumerNumber.length===17){
      const bill=await readInvoiceConsumer(consumerNumber,req.saasTenantId);
      if(bill.record){
        const [payments]=await pool.query("SELECT receipt_number AS receiptNumber,amount,currency,received_at AS paidAt,reference AS transactionId,channel,source FROM payments WHERE tenant_id=? AND consumer_number=? AND status='posted' AND reversal_of_payment_id IS NULL ORDER BY received_at DESC",[req.saasTenantId,consumerNumber]);
        return res.json({consumerNumber,name:bill.record.student_name,payments,pagination:{page:1,pageSize:payments.length,total:payments.length,pages:payments.length?1:0}});
      }
    }
    const student = await findStudent(req.saasTenantId, consumerNumber);
    if (!student) return res.status(404).json({ error: 'Consumer not found', code: 'NOT_FOUND' });
    const [[count]] = await pool.query(
      "SELECT COUNT(*) AS total FROM payments WHERE tenant_id = ? AND student_id = ? AND status = 'posted' AND reversal_of_payment_id IS NULL",
      [req.saasTenantId, student.id]
    );
    const [rows] = await pool.query(
      `SELECT receipt_number AS receiptNumber, amount, currency, received_at AS paidAt,
              reference AS transactionId, channel, source
       FROM payments WHERE tenant_id = ? AND student_id = ? AND status = 'posted' AND reversal_of_payment_id IS NULL
       ORDER BY received_at DESC, created_at DESC LIMIT ? OFFSET ?`,
      [req.saasTenantId, student.id, pageSize, (page - 1) * pageSize]
    );
    res.json({ consumerNumber, name: student.name, payments: rows,
      pagination: { page, pageSize, total: Number(count.total), pages: Math.ceil(Number(count.total) / pageSize) } });
  } catch (err) { next(err); }
});

router.post('/make-payment', async (req, res, next) => {
  try {
    if (config.appEnvironment !== 'sandbox') return res.status(403).json({ error: 'Payment simulation is available only in the isolated sandbox', code: 'VERIFIED_PAYMENT_REQUIRED' });
    const reference = String(req.body.reference || '').trim();
    if (!reference) return res.status(400).json({ error: 'reference is required', code: 'REFERENCE_REQUIRED' });
    const result = await postPayment({
      tenantId: req.saasTenantId, targetType: 'invoice',
      consumerNumber: String(req.body.consumerNumber || '').trim(), amount: Number(req.body.amount),
      receivedAt: req.body.receivedAt || new Date(), channel: req.body.channel || 'saas_gateway',
      externalReference: reference, transactionId: reference,
      idempotencyKey: req.headers['x-idempotency-key'] || reference,
      note: req.body.note || 'Tenant API payment', source: 'sandbox_simulator', actorName: 'Tenant API',
      ipAddress: req.ip, userAgent: req.headers['user-agent'],
    });
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// External systems issue each new fee using a stable request key. Retries never create a second bill.
router.post('/bills', async (req, res, next) => {
  let connection;
  try {
    const {AppError}=require('../middleware/errorHandler');
    const key=String(req.headers['x-idempotency-key'] || '').trim();
    if (!key || key.length>100) throw new AppError('X-Idempotency-Key is required (up to 100 characters)',400,'IDEMPOTENCY_KEY_REQUIRED');
    const charge={studentId:req.body.studentId,amount:assertMoney(req.body.amount),dueDate:req.body.dueDate,
      month:req.body.month || String(req.body.dueDate||'').slice(0,7),lateFee:assertMoney(req.body.lateFee??0,{allowZero:true})};
    if(typeof charge.studentId!=='string' || !charge.studentId) throw new AppError('studentId is required',400,'INVALID_STUDENT');
    const hash=require('crypto').createHash('sha256').update(JSON.stringify(charge)).digest('hex');
    connection=await pool.getConnection();await connection.beginTransaction();await lockBillingTenant(connection,req.saasTenantId);
    const [[prior]]=await connection.query('SELECT * FROM invoice_requests WHERE tenant_id=? AND request_key=?',[req.saasTenantId,key]);
    if(prior && prior.request_hash!==hash) throw new AppError('This request key was used for another bill',409,'IDEMPOTENCY_CONFLICT');
    const created=prior?{id:prior.invoice_id}:(await createInvoiceCharges(connection,req.saasTenantId,[charge]))[0];
    if(!prior) await connection.query('INSERT INTO invoice_requests (tenant_id,request_key,request_hash,invoice_id) VALUES (?,?,?,?)',[req.saasTenantId,key,hash,created.id]);
    const [[row]]=await connection.query('SELECT * FROM invoices WHERE id=? AND tenant_id=?',[created.id,req.saasTenantId]);
    await connection.commit();res.status(prior?200:201).json({data:row,idempotent:Boolean(prior)});
  } catch(err){if(connection)await connection.rollback();next(err);}finally{connection?.release();}
});
router.post('/bills/:id/installments', async (req,res,next)=>{
  let connection;
  try{
    connection=await pool.getConnection();await connection.beginTransaction();
    const result=await require('../services/installmentService').splitInvoice(connection,{tenantId:req.saasTenantId,invoiceId:req.params.id,installments:req.body.installments,actor:{name:'Tenant API'}});
    await connection.commit();res.status(result.idempotent?200:201).json({data:result});
  }catch(err){if(connection)await connection.rollback();next(err);}finally{connection?.release();}
});

router.post('/register-consumer', async (req, res, next) => {
  let connection;
  try {
    const { name, fatherName, class: className, gender, phone, externalRef, invoice } = req.body;
    if (!name?.trim() || !fatherName?.trim() || !className?.trim() || !['male', 'female'].includes(gender)) {
      return res.status(400).json({
        error: 'name, fatherName, class and gender (male|female) are required', code: 'VALIDATION_ERROR',
      });
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();
    await lockBillingTenant(connection, req.saasTenantId);
    if (externalRef) {
      const [existing] = await connection.query(
        `SELECT id, consumer_number, bill_id, name FROM students
         WHERE tenant_id = ? AND bill_id = ? AND deleted_at IS NULL LIMIT 1 FOR UPDATE`,
        [req.saasTenantId, String(externalRef).slice(0, 50)]
      );
      if (existing.length) {
        await connection.commit();
        const [bills]=await connection.query('SELECT id,invoice_number,consumer_number,amount,status,due_date FROM invoices WHERE tenant_id=? AND student_id=? AND deleted_at IS NULL ORDER BY created_at',[req.saasTenantId,existing[0].id]);
        return res.json({ bills, consumerNumber: existing[0].consumer_number || (bills.length===1?bills[0].consumer_number:null), consumerId: existing[0].id,
          name: existing[0].name, externalRef: existing[0].bill_id, tenantId: req.saasTenantId, idempotent: true });
      }
    }
    const allocated = await allocateStudentIdentity(connection, req.saasTenantId);
    const consumerId = uuidv4();
    const billId = externalRef ? String(externalRef).slice(0, 50) : `GW-${uuidv4()}`;
    await connection.query(
      `INSERT INTO students
       (id, tenant_id, name, father_name, class, gender, phone, consumer_number, bill_id, seq_number, status, balance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0)`,
      [consumerId, req.saasTenantId, name.trim(), fatherName.trim(), className.trim(), gender,
        phone?.trim() || null, allocated.consumerNumber, billId, allocated.sequence]
    );
    let invoiceResult = null;
    if (invoice) {
      const amount = assertMoney(invoice.amount);
      if (!Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(String(invoice.dueDate || ''))) {
        const invalid = new Error('invoice.amount and invoice.dueDate (YYYY-MM-DD) are required');
        invalid.statusCode = 400; invalid.code = 'INVALID_INVOICE'; throw invalid;
      }
      const [created] = await createInvoiceCharges(connection, req.saasTenantId, [{
        studentId: consumerId, month: String(invoice.dueDate).slice(0, 7), amount,
        dueDate: invoice.dueDate, lateFee: invoice.lateFee ?? 0, description: invoice.description || 'Registration invoice',
      }]);
      invoiceResult = { id: created.id, invoiceNumber: created.invoiceNumber, consumerNumber: created.consumerNumber, amount, dueDate: invoice.dueDate };
    }
    await connection.commit();
    res.status(201).json({ consumerNumber: invoiceResult?.consumerNumber || allocated.consumerNumber, consumerId, name: name.trim(),
      externalRef: billId, tenantId: req.saasTenantId, ...(invoiceResult ? { invoice: invoiceResult } : {}) });
  } catch (err) {
    if (connection) await connection.rollback();
    next(err);
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
