/**
 * Recover the narrowly identifiable legacy bug: exactly one invoice per student,
 * no charge/debit entries at all, and only canonical, allocated payment credits.
 * Dry-run by default. Apply requires the exact dry-run SHA-256 and database name.
 * Back up and rehearse against a restored copy before using on a live database.
 */
const crypto = require('crypto');
const config = require('../config');
const { pool } = require('../config/database');
const money = value => Math.round(Number(value) * 100) / 100;
const restoreMissingInvoiceCharges = async ({ applyHash, databaseConfirmation } = {}) => {
  const connection=await pool.getConnection();
  try {
    await connection.beginTransaction();
    // Same lock order as payment writers. Snapshot account evidence under locks.
    await connection.query('SELECT id FROM tenants ORDER BY id FOR UPDATE');
    const [invoices]=await connection.query(`SELECT i.id,i.tenant_id,i.student_id,i.invoice_number,i.amount,i.status,i.due_date,
      s.balance AS cached_balance FROM invoices i JOIN students s ON s.id=i.student_id AND s.tenant_id=i.tenant_id
      WHERE i.deleted_at IS NULL AND s.deleted_at IS NULL AND i.amount>0
      AND NOT EXISTS (SELECT 1 FROM ledger_entries l WHERE l.student_id=i.student_id AND l.tenant_id=i.tenant_id AND l.entry_type='charge')
      ORDER BY i.id FOR UPDATE`);
    const plan=[];
    for(const invoice of invoices){
      const [[siblings]]=await connection.query('SELECT COUNT(*) AS n FROM invoices WHERE student_id=? AND tenant_id=?',[invoice.student_id,invoice.tenant_id]);
      if(siblings.n!==1)throw Error(`Ambiguous invoice history: ${invoice.id}`);
      const [entries]=await connection.query('SELECT id,entry_type,debit,credit,reference,bill_id FROM ledger_entries WHERE student_id=? AND tenant_id=? ORDER BY id FOR UPDATE',[invoice.student_id,invoice.tenant_id]);
      const [payments]=await connection.query(`SELECT p.id,p.amount,p.status,p.reference,a.amount AS allocated_amount
        FROM payments p JOIN payment_allocations a ON a.payment_id=p.id AND a.tenant_id=p.tenant_id
        WHERE a.target_type='invoice' AND a.target_id=? AND p.tenant_id=? ORDER BY p.id`,[invoice.id,invoice.tenant_id]);
      if(entries.some(e=>e.entry_type!=='payment'||money(e.debit)!==0||money(e.credit)<=0)
        ||payments.some(p=>p.status!=='posted'||money(p.amount)!==money(p.allocated_amount))
        ||payments.length!==entries.length
        ||entries.some(e=>!payments.some(p=>p.reference===e.reference&&money(p.amount)===money(e.credit)))){
        throw Error(`Ambiguous ledger/payment evidence: ${invoice.id}`);
      }
      const credits=money(entries.reduce((s,e)=>s+Number(e.credit),0));
      if((invoice.status==='paid'&&credits!==money(invoice.amount))
        ||(invoice.status!=='paid'&&credits!==0)||money(invoice.cached_balance)!==0){
        throw Error(`Ambiguous settlement/cache evidence: ${invoice.id}`);
      }
      plan.push({...invoice,entries,payments,resultingBalance:money(Number(invoice.amount)-credits)});
    }
    const hash=crypto.createHash('sha256').update(JSON.stringify(plan)).digest('hex');
    if(applyHash){
      if(databaseConfirmation!==config.db.database||applyHash!==hash)throw Error('Plan or database changed; refusing repair');
      for(const item of plan){
        const id=crypto.randomUUID();
        await connection.query(`INSERT INTO ledger_entries
          (id,tenant_id,student_id,date,description,debit,credit,balance,bill_id,reference,entry_type)
          VALUES (?,?,?,?,?,?,0,?,?,?,'charge')`,[id,item.tenant_id,item.student_id,item.due_date,
          `Restored missing original invoice charge: ${item.invoice_number}`,item.amount,item.resultingBalance,item.invoice_number,item.invoice_number]);
        await connection.query('UPDATE students SET balance=? WHERE id=? AND tenant_id=?',[item.resultingBalance,item.student_id,item.tenant_id]);
        await connection.query(`INSERT INTO audit_logs (id,tenant_id,user_name,action,entity,entity_id,details)
          VALUES (?,?,'Deployment reconciliation','restore_missing_invoice_charge','invoice',?,?)`,
        [crypto.randomUUID(),item.tenant_id,item.id,JSON.stringify({planHash:hash,invoiceNumber:item.invoice_number,amount:item.amount,ledgerEntryId:id,priorCachedBalance:item.cached_balance,resultingBalance:item.resultingBalance,evidence:'Existing invoice, no original debit, exact canonical payment credits; payments and invoice status preserved'})]);
      }
      await connection.commit();
    } else await connection.rollback();
    return {applied:Boolean(applyHash),database:config.db.database,planHash:hash,count:plan.length,totalCharges:money(plan.reduce((s,i)=>s+Number(i.amount),0)),plan};
  }catch(error){await connection.rollback();throw error;}finally{connection.release();}
};
if(require.main===module){
  restoreMissingInvoiceCharges({applyHash:process.env.INVOICE_CHARGE_PLAN_HASH,databaseConfirmation:process.env.INVOICE_CHARGE_DATABASE_CONFIRM})
    .then(report=>process.stdout.write(JSON.stringify(report,null,2)+'\n'))
    .catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=1;}).finally(()=>pool.end());
}
module.exports={restoreMissingInvoiceCharges};
