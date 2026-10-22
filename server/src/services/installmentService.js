const crypto=require('crypto');
const {v4:uuid}=require('uuid');
const {AppError}=require('../middleware/errorHandler');
const {assertMoney,assertDate,money}=require('./billingRules');
const {lockBillingTenant,createInvoiceCharges}=require('./invoiceAccountingService');
const splitInvoice=async(connection,{tenantId,invoiceId,installments,actor})=>{
  if(!Array.isArray(installments)||installments.length<2||installments.length>60) throw new AppError('Choose 2 to 60 installments',400,'INVALID_INSTALLMENTS');
  const parts=installments.map(x=>({amount:assertMoney(x.amount),dueDate:assertDate(x.dueDate),lateFee:assertMoney(x.lateFee??0,{allowZero:true,label:'Late fee'})}));
  if(parts.some((x,i)=>i>0 && x.dueDate<parts[i-1].dueDate)) throw new AppError('Installment due dates must be in order',400,'INVALID_INSTALLMENTS');
  const hash=crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');
  await lockBillingTenant(connection,tenantId);
  const [[prior]]=await connection.query('SELECT * FROM invoice_installment_plans WHERE tenant_id=? AND original_invoice_id=? FOR UPDATE',[tenantId,invoiceId]);
  if(prior) {
    if(prior.request_hash!==hash) throw new AppError('This invoice already has a different installment plan',409,'INSTALLMENT_PLAN_EXISTS');
    const [rows]=await connection.query('SELECT * FROM invoices WHERE tenant_id=? AND installment_plan_id=? ORDER BY installment_number',[tenantId,prior.id]);
    return {planId:prior.id,invoices:rows,idempotent:true};
  }
  const [[policy]]=await connection.query('SELECT billing_mode,installments_enabled FROM tenants WHERE id=?',[tenantId]);
  if(policy.billing_mode!=='invoice'||!policy.installments_enabled) throw new AppError('Enable installments for this institution first',403,'INSTALLMENTS_DISABLED');
  const [[original]]=await connection.query('SELECT * FROM invoices WHERE id=? AND tenant_id=? AND deleted_at IS NULL FOR UPDATE',[invoiceId,tenantId]);
  if(!original) throw new AppError('Invoice not found',404,'INVOICE_NOT_FOUND');
  if(!original.bill_specific || original.status==='paid'||original.installment_plan_id||original.late_fee_applied) throw new AppError('Only an unpaid original bill can be split',409,'INVOICE_NOT_SPLITTABLE');
  const total=parts.reduce((sum,x)=>sum+Math.round(x.amount*100),0);
  if(total!==Math.round(Number(original.amount)*100)) throw new AppError('Installments must total the original invoice amount exactly',400,'INSTALLMENT_TOTAL_MISMATCH');
  const [[allocation]]=await connection.query("SELECT COUNT(*) AS n FROM payment_allocations WHERE tenant_id=? AND target_type='invoice' AND target_id=?",[tenantId,invoiceId]);
  if(Number(allocation.n)) throw new AppError('An invoice with payment history cannot be split',409,'INVOICE_NOT_SPLITTABLE');
  const [[charge]]=await connection.query("SELECT COALESCE(SUM(debit-credit),0) AS amount FROM ledger_entries WHERE tenant_id=? AND student_id=? AND entry_type='charge' AND (reference=? OR bill_id=?)",[tenantId,original.student_id,original.invoice_number,original.invoice_number]);
  if(money(charge.amount)!==money(original.amount)) throw new AppError('Invoice charge requires reconciliation',409,'LEDGER_RECONCILIATION_REQUIRED');
  const [[balance]]=await connection.query('SELECT COALESCE(SUM(debit-credit),0) AS amount FROM ledger_entries WHERE tenant_id=? AND student_id=?',[tenantId,original.student_id]);
  const id=uuid();
  await connection.query('INSERT INTO invoice_installment_plans (id,tenant_id,student_id,original_invoice_id,total_amount,request_hash) VALUES (?,?,?,?,?,?)',[id,tenantId,original.student_id,invoiceId,original.amount,hash]);
  await connection.query(`INSERT INTO ledger_entries (id,tenant_id,student_id,date,description,debit,credit,balance,bill_id,reference,entry_type)
    VALUES (?,?,?,UTC_DATE(),?,0,?,?,?,?,'adjustment')`,[uuid(),tenantId,original.student_id,`Replaced with installments — ${original.invoice_number}`,original.amount,money(Number(balance.amount)-Number(original.amount)),original.invoice_number,`SPLIT-${id}`]);
  await connection.query('UPDATE invoices SET deleted_at=UTC_TIMESTAMP() WHERE id=? AND tenant_id=?',[invoiceId,tenantId]);
  await createInvoiceCharges(connection,tenantId,parts.map((p,i)=>({...p,studentId:original.student_id,month:original.month,feePlanId:original.fee_plan_id,
    description:`Installment ${i+1}/${parts.length} of ${original.invoice_number}`,installmentPlanId:id,installmentNumber:i+1,installmentCount:parts.length})));
  await connection.query(`INSERT INTO audit_logs (id,tenant_id,user_id,user_name,action,entity,entity_id,details)
    VALUES (?,?,?,?,'create','installment_plan',?,?)`,[uuid(),tenantId,actor?.id||null,actor?.name||'Institution',id,`Split ${original.invoice_number} into ${parts.length} bills; base total PKR ${original.amount}; original consumer retired`]);
  const [rows]=await connection.query('SELECT * FROM invoices WHERE tenant_id=? AND installment_plan_id=? ORDER BY installment_number',[tenantId,id]);
  return {planId:id,invoices:rows,idempotent:false};
};
module.exports={splitInvoice};
