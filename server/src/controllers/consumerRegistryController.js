const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

const SOURCE_TYPES = ['school_student', 'organization_applicant', 'payment_request'];
const TENANT_TYPES = ['school', 'org', 'private_agency'];
const TENANT_STATUSES = ['active', 'suspended', 'banned'];
const LIFECYCLE_STAGES = ['testing', 'ready_for_live', 'live', 'offboarding'];

const registryUnion = `
  SELECT
    s.consumer_number,
    'school_student' AS source_type,
    s.id AS source_id,
    s.tenant_id,
    t.name AS tenant_name,
    t.type AS tenant_type,
    t.biller_code,
    t.status AS tenant_status,
    t.lifecycle_stage,
    s.name AS owner_name,
    s.bill_id,
    s.roll_number AS external_reference,
    s.status AS record_status,
    NULL AS secondary_status,
    NULL AS amount,
    s.created_at,
    IF(s.deleted_at IS NULL, 0, 1) AS record_archived,
    IF(t.deleted_at IS NULL, 0, 1) AS tenant_archived
  FROM students s
  INNER JOIN tenants t ON t.id = s.tenant_id
  WHERE s.consumer_number IS NOT NULL AND s.consumer_number <> ''

  UNION ALL

  SELECT
    a.consumer_number,
    'organization_applicant' AS source_type,
    a.id AS source_id,
    a.tenant_id,
    t.name AS tenant_name,
    t.type AS tenant_type,
    t.biller_code,
    t.status AS tenant_status,
    t.lifecycle_stage,
    a.name AS owner_name,
    a.bill_id,
    COALESCE(a.roll_number, a.id) AS external_reference,
    a.application_status AS record_status,
    a.payment_status AS secondary_status,
    NULL AS amount,
    a.created_at,
    IF(a.deleted_at IS NULL, 0, 1) AS record_archived,
    IF(t.deleted_at IS NULL, 0, 1) AS tenant_archived
  FROM applicants a
  INNER JOIN tenants t ON t.id = a.tenant_id
  WHERE a.consumer_number IS NOT NULL AND a.consumer_number <> ''

  UNION ALL

  SELECT
    opr.consumer_number,
    'payment_request' AS source_type,
    opr.id AS source_id,
    opr.tenant_id,
    t.name AS tenant_name,
    t.type AS tenant_type,
    t.biller_code,
    t.status AS tenant_status,
    t.lifecycle_stage,
    COALESCE(opr.customer_name, opr.applicant_id) AS owner_name,
    opr.bill_id,
    opr.application_id AS external_reference,
    opr.status AS record_status,
    opr.status AS secondary_status,
    opr.amount,
    opr.created_at,
    0 AS record_archived,
    IF(t.deleted_at IS NULL, 0, 1) AS tenant_archived
  FROM org_payment_records opr
  INNER JOIN tenants t ON t.id = opr.tenant_id
  WHERE opr.consumer_number IS NOT NULL AND opr.consumer_number <> ''
`;

const readEnum = (value, allowed, label) => {
  if (!value) return null;
  if (!allowed.includes(value)) throw new AppError(`Invalid ${label} filter`, 400, 'INVALID_FILTER');
  return value;
};

const fetchConsumerRegistry = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 25, 1), 100);
    const offset = (page - 1) * pageSize;
    const sourceType = readEnum(req.query.sourceType, SOURCE_TYPES, 'source type');
    const tenantType = readEnum(req.query.tenantType, TENANT_TYPES, 'tenant type');
    const tenantStatus = readEnum(req.query.tenantStatus, TENANT_STATUSES, 'tenant status');
    const lifecycleStage = readEnum(req.query.lifecycleStage, LIFECYCLE_STAGES, 'lifecycle stage');
    const archiveState = readEnum(req.query.archiveState, ['current', 'archived'], 'archive state');
    const consumerLength = req.query.consumerLength ? Number(req.query.consumerLength) : null;
    if (consumerLength && ![14, 20, 24].includes(consumerLength)) {
      throw new AppError('Consumer length must be 14, 20, or 24', 400, 'INVALID_FILTER');
    }

    const conditions = ['1=1'];
    const params = [];
    const add = (condition, value) => { conditions.push(condition); params.push(value); };
    if (sourceType) add('registry.source_type = ?', sourceType);
    if (req.query.tenantId) add('registry.tenant_id = ?', req.query.tenantId);
    if (tenantType) add('registry.tenant_type = ?', tenantType);
    if (tenantStatus) add('registry.tenant_status = ?', tenantStatus);
    if (lifecycleStage) add('registry.lifecycle_stage = ?', lifecycleStage);
    if (req.query.recordStatus) add('registry.record_status = ?', req.query.recordStatus);
    if (consumerLength) add('CHAR_LENGTH(registry.consumer_number) = ?', consumerLength);
    if (archiveState === 'current') conditions.push('registry.record_archived = 0 AND registry.tenant_archived = 0');
    if (archiveState === 'archived') conditions.push('(registry.record_archived = 1 OR registry.tenant_archived = 1)');

    const search = String(req.query.search || '').trim();
    if (search) {
      const term = `%${search.slice(0, 100)}%`;
      conditions.push(`(
        registry.consumer_number LIKE ? OR registry.owner_name LIKE ? OR registry.tenant_name LIKE ?
        OR registry.biller_code LIKE ? OR registry.bill_id LIKE ? OR registry.external_reference LIKE ?
      )`);
      params.push(term, term, term, term, term, term);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;

    const [countRows] = await pool.query(
      `SELECT registry.source_type, COUNT(*) AS count
       FROM (${registryUnion}) registry ${where}
       GROUP BY registry.source_type`,
      params
    );
    const bySource = { schoolStudent: 0, organizationApplicant: 0, paymentRequest: 0 };
    for (const row of countRows) {
      if (row.source_type === 'school_student') bySource.schoolStudent = Number(row.count);
      if (row.source_type === 'organization_applicant') bySource.organizationApplicant = Number(row.count);
      if (row.source_type === 'payment_request') bySource.paymentRequest = Number(row.count);
    }
    const total = Object.values(bySource).reduce((sum, count) => sum + count, 0);

    const [rows] = await pool.query(
      `SELECT registry.*
       FROM (${registryUnion}) registry ${where}
       ORDER BY registry.created_at DESC, registry.source_id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    const [tenants] = await pool.query(
      `SELECT id, name, type, status, lifecycle_stage
       FROM tenants
       ORDER BY (deleted_at IS NOT NULL), name ASC`
    );

    res.json({
      data: rows,
      meta: {
        page,
        pageSize,
        total,
        pages: Math.ceil(total / pageSize),
        bySource,
        tenants,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { fetchConsumerRegistry };
