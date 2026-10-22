const config=require('../config');
const {pool} = require('../config/database');
const {payableQuote} = require('./billingRules');
const readInvoiceConsumer = async (consumerNumber, tenantId = null) => {
  const [rows] = await pool.query(`SELECT i.*,s.status AS student_status,s.deleted_at AS student_deleted,
    t.status AS tenant_status,t.lifecycle_stage,t.name AS tenant_name,t.biller_code,t.deleted_at AS tenant_deleted
    FROM invoices i JOIN students s ON s.id=i.student_id AND s.tenant_id=i.tenant_id
    JOIN tenants t ON t.id=i.tenant_id WHERE i.payment_consumer_number = ? ${tenantId ? 'AND i.tenant_id = ?' : ''} LIMIT 1`,tenantId?[consumerNumber,tenantId]:[consumerNumber]);
  const record=rows[0];
  if(!record || record.deleted_at || record.student_deleted || record.tenant_deleted) return {code:'01',record:null};
  if(record.tenant_status !== 'active' || (config.appEnvironment !== 'sandbox' && record.lifecycle_stage !== 'live')) return {code:'01',record};
  if(record.student_status !== 'active') return {code:'02',record};
  if(record.status === 'paid') {
    const [payments]=await pool.query(`SELECT p.amount,p.received_at,p.voucher_number AS transaction_id
      FROM payments p JOIN payment_allocations a ON a.payment_id=p.id AND a.tenant_id=p.tenant_id
      WHERE a.target_type='invoice' AND a.target_id=? AND p.tenant_id=? AND p.status='posted' AND p.reversal_of_payment_id IS NULL
      ORDER BY p.received_at DESC LIMIT 1`,[record.id,record.tenant_id]);
    return {code:'06',record,payment:payments[0]};
  }
  const [[ledger]]=await pool.query('SELECT COALESCE(SUM(debit),0) AS debit,COALESCE(SUM(credit),0) AS credit FROM ledger_entries WHERE tenant_id=? AND student_id=?',[record.tenant_id,record.student_id]);
  const [[pending]]=await pool.query("SELECT COALESCE(SUM(amount),0) AS amount FROM invoices WHERE tenant_id=? AND student_id=? AND status!='paid' AND deleted_at IS NULL",[record.tenant_id,record.student_id]);
  if(Number(ledger.debit)-Number(ledger.credit)+0.005 < Number(pending.amount)) return {code:'01',record};
  return {code:'00',record,quote:payableQuote([record],ledger,new Date(),true)};
};
const invoiceWireResponse = ({code,record,payment,quote}) => {
  const blank=n=>' '.repeat(n),date=v=>String(v).slice(0,10).replaceAll('-','');
  const amount=v=>'+'+String(Math.round(Number(v)*100)).padStart(13,'0');
  const success=code==='00'||code==='06';
  return {response_Code:code,consumer_Detail:success?String(record.student_name).slice(0,30).padEnd(30,' '):blank(30),
    bill_status:code==='00'?'U':code==='06'?'P':code==='02'?'B':' ',
    due_date:success?date(record.due_date):blank(8),
    amount_within_dueDate:amount(code==='00'?quote.baseDue:0),amount_after_dueDate:amount(code==='00'?quote.baseDue+(record.late_fee_applied?0:Number(record.late_fee||0)):0),
    billing_month:success?String(record.month).replace('-','').slice(2):blank(4),
    date_paid:payment?date(payment.received_at):blank(8),
    amount_paid:payment?String(Math.round(Number(payment.amount)*100)).padStart(12,'0'):blank(12),
    tran_auth_Id:payment&&/^\d{6}$/.test(String(payment.transaction_id))?String(payment.transaction_id):blank(6),reserved:''};
};
module.exports={readInvoiceConsumer,invoiceWireResponse};
