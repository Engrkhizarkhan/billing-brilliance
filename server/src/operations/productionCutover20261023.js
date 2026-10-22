/** One-time, explicit UAT cleanup. Never truncate or reset issued-number counters. */
const {pool}=require('../config/database');
const crypto=require('crypto');
const school='42c85bec-3270-4733-982a-48fb20fd729a';
const org='4d92e4b3-81a1-4af4-93bd-ac5f50e12368';
const ids=[school,org];
const expected={students:20,invoices:20,ledger_entries:27,org_payment_records:15,org_postings:1,payments:22,payment_allocations:22,transactions:22,outbox_events:22,org_payment_notifications:31,notifications:12,applicants:0,payment_plan_assignments:0,student_scholarship_assignments:0,invoice_installment_plans:0,invoice_requests:0};
async function cutover(apply=false){
  const c=await pool.getConnection();
  try{
    await c.beginTransaction();
    const [tenants]=await c.query('SELECT id,biller_code,next_consumer_sequence FROM tenants WHERE id IN (?) ORDER BY id FOR UPDATE',[ids]);
    if(tenants.length!==2 || tenants.find(x=>x.id===school)?.biller_code!=='1001' || tenants.find(x=>x.id===org)?.biller_code!=='1002')throw new Error('Tenant identity mismatch');
    const [students]=await c.query('SELECT id,name,consumer_number FROM students WHERE tenant_id IN (?)',[ids]);
    const [records]=await c.query('SELECT id,customer_name,consumer_number FROM org_payment_records WHERE tenant_id IN (?)',[ids]);
    if(students.some(x=>!x.name.startsWith('UAT ')||!/^1051721001\d{4}$/.test(x.consumer_number)) || records.some(x=>!x.customer_name.startsWith('UAT ')||!/^1051721002\d{14}$/.test(x.consumer_number)))throw new Error('Non-UAT consumer found; refusing cleanup');
    const [[post]]=await c.query('SELECT title FROM org_postings WHERE tenant_id=?',[org]);
    if(post?.title!=='1BILL UAT slab cases — 9 October 2026')throw new Error('Posting changed');
    const counts={};
    for(const [table,n] of Object.entries(expected)){
      const [[row]]=await c.query(`SELECT COUNT(*) n FROM ${table} WHERE tenant_id IN (?)`,[ids]);counts[table]=Number(row.n);
      if(Number(row.n)!==n)throw new Error(`Changed ${table} count: expected ${n}, found ${row.n}; review before cleanup`);
    }
    const [[foreign]]=await c.query('SELECT COUNT(*) n FROM invoices WHERE tenant_id IN (?) AND (student_id IS NULL OR student_id NOT IN (?))',[ids,students.map(x=>x.id)]);
    if(Number(foreign.n))throw new Error('Invoice ownership mismatch');
    const [[missing]]=await c.query(`SELECT COUNT(*) n FROM (SELECT consumer_number FROM students WHERE tenant_id IN (?) UNION SELECT consumer_number FROM org_payment_records WHERE tenant_id IN (?)) u LEFT JOIN consumer_number_reservations r ON r.consumer_number=u.consumer_number WHERE r.consumer_number IS NULL`,[ids,ids]);
    if(Number(missing.n))throw new Error('Issued numbers have not been reserved');
    const report={apply,counts,sequences:tenants,consumerCount:students.length+records.length};
    if(!apply){await c.rollback();return report;}
    if(process.env.CONFIRM_UAT_CUTOVER!=='REMOVE_VERIFIED_35_UAT_CONSUMERS_AFTER_RESTORE_DRILL')throw new Error('Explicit cutover confirmation is missing');
    for(const table of ['org_payment_notifications','payment_allocations','outbox_events','ledger_entries','transactions'])await c.query(`DELETE FROM ${table} WHERE tenant_id IN (?)`,[ids]);
    await c.query('DELETE FROM payments WHERE tenant_id IN (?) AND reversal_of_payment_id IS NOT NULL',[ids]);
    for(const table of ['payments','invoices','org_payment_records','org_postings','students','notifications'])await c.query(`DELETE FROM ${table} WHERE tenant_id IN (?)`,[ids]);
    await c.query("UPDATE tenants SET consumer_number_length=17,billing_mode=CASE WHEN id=? THEN 'invoice' ELSE 'legacy' END,installments_enabled=0 WHERE id IN (?)",[school,ids]);
    for(const id of ids)await c.query(`INSERT INTO audit_logs (id,tenant_id,user_name,action,entity,entity_id,details) VALUES (?,?,'Production cutover','delete','uat_cleanup',?,?)`,[crypto.randomUUID(),id,id,JSON.stringify({date:'2026-10-23',reason:'User authorized production transition; verified encrypted backup and local restore',counts,preserved:'Accounts, settings, audit logs, consumer reservations and sequence counters',numberLength:17})]);
    await c.commit();return report;
  }catch(e){await c.rollback();throw e;}finally{c.release();}
}
if(require.main===module)cutover(process.argv.includes('--apply')).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool.end());
module.exports={cutover};
