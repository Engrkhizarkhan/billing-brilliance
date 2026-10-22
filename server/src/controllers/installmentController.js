const {pool}=require('../config/database');
const {AppError}=require('../middleware/errorHandler');
const {getCapacity}=require('../services/consumerNumberService');
const {splitInvoice}=require('../services/installmentService');
const {auditLog}=require('../middleware/auditLog');
const getPolicy=async(req,res,next)=>{
  try {
    const [[row]]=await pool.query('SELECT billing_mode,installments_enabled,consumer_number_length,biller_code,next_consumer_sequence FROM tenants WHERE id=? AND deleted_at IS NULL',[req.tenantId]);
    if(!row) throw new AppError('Institution not found',404,'TENANT_NOT_FOUND');
    const capacity=getCapacity(row.consumer_number_length,row.biller_code);
    const remaining=Math.max(0,capacity.maxSequence-Number(row.next_consumer_sequence)+1);
    res.json({data:{...row,capacity:capacity.maxSequence,remaining,capacity_warning:remaining<=capacity.maxSequence*0.2}});
  }catch(e){next(e);}
};
const updatePolicy=async(req,res,next)=>{
  try {
    if(typeof req.body.installmentsEnabled!=='boolean') throw new AppError('installmentsEnabled must be true or false',400,'INVALID_PARAM');
    const [updated]=await pool.query("UPDATE tenants SET installments_enabled=? WHERE id=? AND billing_mode='invoice' AND deleted_at IS NULL",[req.body.installmentsEnabled?1:0,req.tenantId]);
    if(!updated.affectedRows) throw new AppError('Institution must use bill-specific numbering',409,'BILL_NUMBERING_REQUIRED');
    await auditLog(req,'update','billing_policy',req.tenantId,`Installments ${req.body.installmentsEnabled?'enabled':'disabled'}; existing plans unchanged`);
    return getPolicy(req,res,next);
  }catch(e){next(e);}
};
const createInstallments=async(req,res,next)=>{
  let connection;
  try {
    connection=await pool.getConnection();await connection.beginTransaction();
    const result=await splitInvoice(connection,{tenantId:req.tenantId,invoiceId:req.params.id,installments:req.body.installments,actor:req.user});
    await connection.commit();res.status(result.idempotent?200:201).json({data:result});
  }catch(e){if(connection)await connection.rollback();next(e);}finally{connection?.release();}
};
module.exports={getPolicy,updatePolicy,createInstallments};
