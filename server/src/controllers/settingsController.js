const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const net = require('net');
const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { auditLog } = require('../middleware/auditLog');
const { createRequestNotification } = require('../services/notificationService');
const { assertSafePublicHttpsUrl } = require('../services/urlSafety');
const { sendWebhook } = require('../services/safeWebhookTransport');

const resolveTenantId = (req) => req.tenantId || req.body.tenantId || req.query.tenantId || null;

const parseJsonValue = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const orgSecuritySummary = (value) => {
  const parsed = value && typeof value === 'object' ? value : {};
  const rawSourceIps = parsed.sourceIp;
  const sourceIps = (Array.isArray(rawSourceIps)
    ? rawSourceIps
    : String(rawSourceIps || '').split(','))
    .map((ip) => String(ip).trim())
    .filter(Boolean);
  return { configured: sourceIps.length > 0, sourceIpCount: sourceIps.length };
};

const { computeNextDueDate, assertDate } = require('../services/billingRules');
const { lockBillingTenant, createInvoiceCharges } = require('../services/invoiceAccountingService');

const fetchFeePlans = async (req, res, next) => {
  try {
    let where = 'WHERE deleted_at IS NULL';
    const params = [];
    if (req.tenantId) { where += ' AND tenant_id = ?'; params.push(req.tenantId); }

    const [rows] = await pool.query(`SELECT * FROM fee_plans ${where} ORDER BY name`, params);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const createFeePlan = async (req, res, next) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) throw new AppError('Tenant ID is required', 400);

    const { name, amount, frequency, dueDay = 10, lateFee = 0, planType = 'tuition' } = req.body;
    if (!name || amount === undefined || !frequency) {
      throw new AppError('Name, amount, and frequency are required', 400);
    }
    if (!['tuition', 'additional'].includes(planType)) {
      throw new AppError('planType must be "tuition" or "additional"', 400);
    }

    const id = uuidv4();
    await pool.query(
      `INSERT INTO fee_plans (id, tenant_id, name, amount, frequency, due_day, late_fee, plan_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, name, amount, frequency, dueDay, lateFee, planType]
    );

    await auditLog(req, 'create', 'fee_plan', id, `Fee plan ${name} created (${planType})`);
    await createRequestNotification(req, {
      title: 'Fee plan created',
      message: `${name} is now available for assignment via Payment Programs.`,
      type: 'system',
      tenantId,
    });

    const [rows] = await pool.query('SELECT * FROM fee_plans WHERE id = ?', [id]);
    res.status(201).json({ data: rows[0], message: 'Fee plan created' });
  } catch (err) {
    next(err);
  }
};

const updateFeePlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = resolveTenantId(req);
    const [existing] = await pool.query(
      'SELECT id FROM fee_plans WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL',
      [id, tenantId]
    );
    if (!existing.length) return res.status(404).json({ message: 'Fee plan not found' });

    const { name, amount, frequency, dueDay, lateFee, planType } = req.body;
    if (planType !== undefined && !['tuition', 'additional'].includes(planType)) {
      throw new AppError('planType must be "tuition" or "additional"', 400);
    }
    await pool.query(
      `UPDATE fee_plans SET name = COALESCE(?, name), amount = COALESCE(?, amount),
       frequency = COALESCE(?, frequency), due_day = COALESCE(?, due_day),
       late_fee = COALESCE(?, late_fee), plan_type = COALESCE(?, plan_type) WHERE id = ?`,
      [name ?? null, amount ?? null, frequency ?? null, dueDay ?? null, lateFee ?? null, planType ?? null, id]
    );
    await auditLog(req, 'update', 'fee_plan', id, `Fee plan ${id} updated`);
    const [rows] = await pool.query('SELECT * FROM fee_plans WHERE id = ?', [id]);
    res.json({ data: rows[0], message: 'Fee plan updated' });
  } catch (err) {
    next(err);
  }
};

const deleteFeePlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = resolveTenantId(req);
    const [existing] = await pool.query(
      'SELECT id, name FROM fee_plans WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL',
      [id, tenantId]
    );
    if (!existing.length) return res.status(404).json({ message: 'Fee plan not found' });
    await pool.query('UPDATE fee_plans SET deleted_at = NOW() WHERE id = ?', [id]);
    // Remove all assignments for this fee plan so students no longer show it in payment programs
    await pool.query('DELETE FROM payment_plan_assignments WHERE fee_plan_id = ?', [id]);
    await auditLog(req, 'delete', 'fee_plan', id, `Fee plan ${existing[0].name} deleted`);
    res.json({ message: 'Fee plan deleted' });
  } catch (err) {
    next(err);
  }
};

const fetchFeeHeads = async (req, res, next) => {
  try {
    let where = 'WHERE deleted_at IS NULL';
    const params = [];
    if (req.tenantId) { where += ' AND tenant_id = ?'; params.push(req.tenantId); }

    const [rows] = await pool.query(`SELECT * FROM fee_heads ${where} ORDER BY name`, params);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const fetchScholarships = async (req, res, next) => {
  try {
    let where = 'WHERE deleted_at IS NULL';
    const params = [];
    if (req.tenantId) { where += ' AND tenant_id = ?'; params.push(req.tenantId); }
    const { status } = req.query;
    if (status) { where += ' AND status = ?'; params.push(status); }

    const [rows] = await pool.query(`SELECT * FROM scholarships ${where} ORDER BY name`, params);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const fetchStudentScholarships = async (req, res, next) => {
  try {
    let where = 'WHERE ssa.student_id = ? AND ssa.status = \'active\'';
    const params = [req.params.studentId];
    if (req.tenantId) {
      where += ' AND ssa.tenant_id = ?';
      params.push(req.tenantId);
    }

    const [rows] = await pool.query(
      `SELECT ssa.*, s.name as scholarship_name, s.type as scholarship_type, s.value as scholarship_value
       FROM student_scholarship_assignments ssa
       JOIN scholarships s ON ssa.scholarship_id = s.id
       ${where}`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const createScholarship = async (req, res, next) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) throw new AppError('Tenant ID is required', 400);

    const { name, type, value, startDate, endDate, isLifetime = false } = req.body;
    if (!name || !type || value === undefined || !startDate) {
      throw new AppError('Name, type, value, and start date are required', 400);
    }

    const id = uuidv4();
    await pool.query(
      `INSERT INTO scholarships (id, tenant_id, name, type, value, start_date, end_date, is_lifetime, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [id, tenantId, name, type, value, startDate, isLifetime ? null : (endDate || null), isLifetime ? 1 : 0]
    );

    await auditLog(req, 'create', 'scholarship', id, `Scholarship ${name} created`);
    await createRequestNotification(req, {
      title: 'Scholarship created',
      message: `${name} is now available for student assignment.`,
      type: 'system',
      tenantId,
    });

    const [rows] = await pool.query('SELECT * FROM scholarships WHERE id = ?', [id]);
    res.status(201).json({ data: rows[0], message: 'Scholarship created' });
  } catch (err) {
    next(err);
  }
};

const updateScholarshipStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive', 'expired'].includes(status)) {
      throw new AppError('Invalid scholarship status', 400);
    }

    let where = 'WHERE id = ? AND deleted_at IS NULL';
    const params = [req.params.id];
    if (req.tenantId) {
      where += ' AND tenant_id = ?';
      params.push(req.tenantId);
    }

    const [rows] = await pool.query(`SELECT * FROM scholarships ${where}`, params);
    if (rows.length === 0) throw new AppError('Scholarship not found', 404);

    await pool.query('UPDATE scholarships SET status = ? WHERE id = ?', [status, req.params.id]);
    await auditLog(req, 'update', 'scholarship', req.params.id, `Scholarship ${rows[0].name} marked ${status}`);
    await createRequestNotification(req, {
      title: 'Scholarship status updated',
      message: `${rows[0].name} is now ${status}.`,
      type: 'system',
    });

    const [updated] = await pool.query('SELECT * FROM scholarships WHERE id = ?', [req.params.id]);
    res.json({ data: updated[0], message: 'Scholarship updated' });
  } catch (err) {
    next(err);
  }
};

const fetchAllScholarshipAssignments = async (req, res, next) => {
  try {
    let where = 'WHERE ssa.tenant_id IS NOT NULL';
    const params = [];
    if (req.tenantId) {
      where += ' AND ssa.tenant_id = ?';
      params.push(req.tenantId);
    }

    const [rows] = await pool.query(
      `SELECT ssa.*, s.name as scholarship_name, s.type as scholarship_type, s.value as scholarship_value,
              st.name as student_name, st.class as class_name, st.section, st.roll_number, st.consumer_number
       FROM student_scholarship_assignments ssa
       JOIN scholarships s ON s.id = ssa.scholarship_id
       JOIN students st ON st.id = ssa.student_id
       ${where}
       ORDER BY ssa.assigned_at DESC`,
      params
    );

    const mapped = rows.map((r) => ({
      id: r.id,
      studentId: r.student_id,
      scholarshipId: r.scholarship_id,
      tenantId: r.tenant_id,
      effectiveFrom: r.effective_from,
      assignedAt: r.assigned_at,
      status: r.status,
      studentName: r.student_name,
      className: r.class_name,
      section: r.section,
      rollNumber: r.roll_number,
      consumerNumber: r.consumer_number,
      scholarshipName: r.scholarship_name,
      scholarshipType: r.scholarship_type,
      scholarshipValue: r.scholarship_value,
    }));

    res.json({ data: mapped });
  } catch (err) {
    next(err);
  }
};

const createScholarshipAssignment = async (req, res, next) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) throw new AppError('Tenant ID is required', 400);

    const { studentId, scholarshipId, effectiveFrom } = req.body;
    if (!studentId || !scholarshipId || !effectiveFrom) {
      throw new AppError('Student, scholarship, and effective date are required', 400);
    }

    const [students] = await pool.query(
      'SELECT id, name FROM students WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL',
      [studentId, tenantId]
    );
    if (students.length === 0) throw new AppError('Student not found', 404);

    const [scholarships] = await pool.query(
      'SELECT id, name FROM scholarships WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL',
      [scholarshipId, tenantId]
    );
    if (scholarships.length === 0) throw new AppError('Scholarship not found', 404);

    const [existing] = await pool.query(
      'SELECT * FROM student_scholarship_assignments WHERE student_id = ? AND scholarship_id = ? LIMIT 1',
      [studentId, scholarshipId]
    );

    let assignmentId = existing[0]?.id;
    if (existing.length > 0) {
      await pool.query(
        `UPDATE student_scholarship_assignments
         SET status = 'active', effective_from = ?, assigned_at = NOW()
         WHERE id = ?`,
        [effectiveFrom, assignmentId]
      );
    } else {
      assignmentId = uuidv4();
      await pool.query(
        `INSERT INTO student_scholarship_assignments (id, tenant_id, student_id, scholarship_id, effective_from, status)
         VALUES (?, ?, ?, ?, ?, 'active')`,
        [assignmentId, tenantId, studentId, scholarshipId, effectiveFrom]
      );
    }

    await auditLog(req, 'create', 'scholarship_assignment', assignmentId, `${students[0].name} assigned ${scholarships[0].name}`);
    await createRequestNotification(req, {
      title: 'Scholarship assigned',
      message: `${students[0].name} received ${scholarships[0].name}.`,
      type: 'system',
      tenantId,
    });

    const [rows] = await pool.query('SELECT * FROM student_scholarship_assignments WHERE id = ?', [assignmentId]);
    res.status(existing.length > 0 ? 200 : 201).json({ data: rows[0], message: 'Scholarship assigned' });
  } catch (err) {
    next(err);
  }
};

const updateScholarshipAssignment = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      throw new AppError('Invalid assignment status', 400);
    }

    let where = 'WHERE ssa.id = ?';
    const params = [req.params.id];
    if (req.tenantId) {
      where += ' AND ssa.tenant_id = ?';
      params.push(req.tenantId);
    }

    const [rows] = await pool.query(
      `SELECT ssa.*, st.name as student_name, s.name as scholarship_name
       FROM student_scholarship_assignments ssa
       JOIN students st ON st.id = ssa.student_id
       JOIN scholarships s ON s.id = ssa.scholarship_id
       ${where}`,
      params
    );
    if (rows.length === 0) throw new AppError('Scholarship assignment not found', 404);

    await pool.query('UPDATE student_scholarship_assignments SET status = ? WHERE id = ?', [status, req.params.id]);
    await auditLog(req, 'update', 'scholarship_assignment', req.params.id, `${rows[0].student_name} assignment marked ${status}`);

    const [updated] = await pool.query('SELECT * FROM student_scholarship_assignments WHERE id = ?', [req.params.id]);
    res.json({ data: updated[0], message: 'Scholarship assignment updated' });
  } catch (err) {
    next(err);
  }
};

const fetchPaymentPlanAssignments = async (req, res, next) => {
  try {
    let where = 'WHERE ppa.tenant_id IS NOT NULL';
    const params = [];
    if (req.tenantId) {
      where += ' AND ppa.tenant_id = ?';
      params.push(req.tenantId);
    }
    if (req.query.status) {
      where += ' AND ppa.status = ?';
      params.push(req.query.status);
    }

    const [rows] = await pool.query(
      `SELECT ppa.*, s.name as student_name, s.consumer_number, s.class as class_name, s.section as section_name,
              fp.name as plan_name, fp.amount, fp.frequency, fp.due_day, fp.plan_type
       FROM payment_plan_assignments ppa
       JOIN students s ON s.id = ppa.student_id
       JOIN fee_plans fp ON fp.id = ppa.fee_plan_id
       ${where}
       ORDER BY ppa.assigned_date DESC, ppa.created_at DESC`,
      params
    );

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const createPaymentPlanAssignment = async (req, res, next) => {
  let connection;
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) throw new AppError('Tenant ID is required', 400);

    const {
      studentId,
      feePlanId,
      assignedDate,
      nextDueDate,
      status = 'active',
      assignedVia = 'individual',
    } = req.body;

    if (!studentId || !feePlanId) {
      throw new AppError('Student and fee plan are required', 400);
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.query('SELECT id FROM tenants WHERE id = ? FOR UPDATE', [tenantId]);
    const [students] = await connection.query(
      'SELECT id, name, bill_id, consumer_number FROM students WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL',
      [studentId, tenantId]
    );
    if (students.length === 0) throw new AppError('Student not found', 404);

    const [plans] = await connection.query(
      'SELECT id, name, amount, due_day, frequency, plan_type FROM fee_plans WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL',
      [feePlanId, tenantId]
    );
    if (plans.length === 0) throw new AppError('Fee plan not found', 404);

    const planType = plans[0].plan_type || 'tuition';

    if (planType === 'tuition') {
      // Enforce: each student may have at most ONE active/pending tuition fee plan
      const [existingTuition] = await connection.query(
        `SELECT ppa.id, fp.name as plan_name FROM payment_plan_assignments ppa
         JOIN fee_plans fp ON fp.id = ppa.fee_plan_id
         WHERE ppa.student_id = ? AND ppa.status IN ('active', 'pending') AND fp.plan_type = 'tuition'
         LIMIT 1`,
        [studentId]
      );
      if (existingTuition.length > 0) {
        throw new AppError(
          `Student already has an active tuition fee plan (${existingTuition[0].plan_name}). Remove it first before assigning a new one.`,
          409
        );
      }
    }

    // Block assigning the exact same plan to the same student twice (applies to all plan types)
    const [dupCheck] = await connection.query(
      `SELECT id FROM payment_plan_assignments
       WHERE student_id = ? AND fee_plan_id = ? AND status IN ('active', 'pending')
       LIMIT 1`,
      [studentId, feePlanId]
    );
    if (dupCheck.length > 0) {
      throw new AppError(`"${plans[0].name}" is already assigned to this student.`, 409);
    }

    const id = uuidv4();
    const resolvedAssignedDate = assignedDate || new Date().toISOString().slice(0, 10);
    // Compute next_due_date for all plans that have a due_day (even additional/service plans)
    // Only skip it for one-time frequency plans
    const isOneTime = (plans[0].frequency || '').toLowerCase() === 'one-time';
    const resolvedNextDueDate = isOneTime
      ? null
      : (nextDueDate || computeNextDueDate(resolvedAssignedDate, plans[0].due_day));

    assertDate(resolvedAssignedDate);
    if (planType === 'additional' || isOneTime) await lockBillingTenant(connection, tenantId);
    // One-time plans are immediately completed after being charged once
    const resolvedStatus = isOneTime ? 'completed' : status;

    await connection.query(
      `INSERT INTO payment_plan_assignments (id, tenant_id, student_id, fee_plan_id, status, assigned_via, assigned_date, next_due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, studentId, feePlanId, resolvedStatus, assignedVia, resolvedAssignedDate, resolvedNextDueDate]
    );

    if (planType === 'additional' || isOneTime) {
      await createInvoiceCharges(connection, tenantId, [{ studentId, feePlanId,
        month: resolvedAssignedDate.slice(0, 7), dueDate: resolvedAssignedDate,
        amount: plans[0].amount, description: plans[0].name }]);
    }
    await connection.commit();

    await auditLog(req, 'create', 'payment_plan_assignment', id, `${students[0].name} assigned ${plans[0].name}`);
    await createRequestNotification(req, {
      title: 'Payment plan assigned',
      message: `${students[0].name} was assigned ${plans[0].name}.`,
      type: 'system',
      tenantId,
    });

    const [rows] = await connection.query(
      `SELECT ppa.*, s.name as student_name, s.consumer_number, s.class as class_name, s.section as section_name,
              fp.name as plan_name, fp.amount, fp.frequency, fp.due_day, fp.plan_type
       FROM payment_plan_assignments ppa
       JOIN students s ON s.id = ppa.student_id
       JOIN fee_plans fp ON fp.id = ppa.fee_plan_id
       WHERE ppa.id = ?`,
      [id]
    );

    res.status(201).json({ data: rows[0], message: 'Payment plan assigned' });
  } catch (err) {
    if (connection) await connection.rollback();
    next(err);
  } finally { if (connection) connection.release(); }
};

const bulkCreateScholarshipAssignments = async (req, res, next) => {
  let connection;
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) throw new AppError('Tenant ID is required', 400);
    const { scholarshipId, effectiveFrom, studentIds = [], className, section } = req.body;
    if (!scholarshipId || !effectiveFrom) throw new AppError('Scholarship and effective date are required', 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) throw new AppError('Effective date must be YYYY-MM-DD', 400);
    if (!Array.isArray(studentIds) || studentIds.length > 2500) throw new AppError('Invalid or oversized student selection', 400);
    if (studentIds.length === 0 && !className) throw new AppError('Select at least one student or class', 400);

    connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.query('SELECT id FROM tenants WHERE id = ? FOR UPDATE', [tenantId]);
    const [scholarships] = await connection.query(
      `SELECT id, name FROM scholarships
       WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL AND status = 'active'`,
      [scholarshipId, tenantId]
    );
    if (scholarships.length === 0) throw new AppError('Active scholarship not found', 404);

    let studentSql = `SELECT id FROM students WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'active'`;
    const studentParams = [tenantId];
    if (studentIds.length > 0) { studentSql += ' AND id IN (?)'; studentParams.push(studentIds); }
    if (className) { studentSql += ' AND class = ?'; studentParams.push(className); }
    if (section && section !== 'all') { studentSql += ' AND section = ?'; studentParams.push(section); }
    const [students] = await connection.query(studentSql, studentParams);
    if (students.length === 0) throw new AppError('No active students matched the selected scope', 404);

    const values = students.map((student) => [
      uuidv4(), tenantId, student.id, scholarshipId, effectiveFrom, 'active',
    ]);
    await connection.query(
      `INSERT INTO student_scholarship_assignments
       (id, tenant_id, student_id, scholarship_id, effective_from, status)
       VALUES ?
       ON DUPLICATE KEY UPDATE status = 'active', effective_from = VALUES(effective_from), assigned_at = NOW()`,
      [values]
    );
    await connection.commit();

    await auditLog(req, 'create', 'scholarship_assignment_batch', scholarshipId, `${scholarships[0].name} assigned to ${students.length} student(s)`);
    await createRequestNotification(req, {
      title: 'Scholarship assignment completed',
      message: `${scholarships[0].name} was assigned or reactivated for ${students.length} student(s).`,
      type: 'system',
      tenantId,
    });
    res.status(201).json({ data: { assigned: students.length }, message: 'Bulk scholarship assignment completed' });
  } catch (err) {
    if (connection) await connection.rollback();
    next(err);
  } finally {
    if (connection) connection.release();
  }
};

// Bulk assignment is intentionally a single, tenant-serialized transaction.
// A class containing thousands of students must not fan out into thousands of
// browser requests (and hit the API rate limiter or leave a partial result).
const bulkCreatePaymentPlanAssignments = async (req, res, next) => {
  let connection;
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) throw new AppError('Tenant ID is required', 400);

    const {
      feePlanId,
      studentIds = [],
      classNames = [],
      assignedDate = new Date().toISOString().slice(0, 10),
      assignedVia = classNames.length > 0 ? 'class' : 'individual',
    } = req.body;
    if (!feePlanId) throw new AppError('Fee plan is required', 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(assignedDate)) throw new AppError('Assigned date must be YYYY-MM-DD', 400);
    if (!['class', 'individual'].includes(assignedVia)) throw new AppError('Invalid assignment source', 400);
    if (!Array.isArray(studentIds) || !Array.isArray(classNames)) throw new AppError('Student IDs and class names must be arrays', 400);
    if (studentIds.length > 2500 || classNames.length > 100) throw new AppError('Bulk assignment exceeds the allowed batch size', 400);
    if (studentIds.length === 0 && classNames.length === 0) throw new AppError('Select at least one student or class', 400);

    connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.query('SELECT id FROM tenants WHERE id = ? FOR UPDATE', [tenantId]);

    const [plans] = await connection.query(
      `SELECT id, name, amount, due_day, frequency, COALESCE(plan_type, 'tuition') AS plan_type
       FROM fee_plans WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [feePlanId, tenantId]
    );
    if (plans.length === 0) throw new AppError('Fee plan not found', 404);
    const plan = plans[0];

    const selectors = [];
    const selectorParams = [tenantId];
    if (studentIds.length > 0) { selectors.push('id IN (?)'); selectorParams.push(studentIds); }
    if (classNames.length > 0) { selectors.push('class IN (?)'); selectorParams.push(classNames); }
    const [students] = await connection.query(
      `SELECT id, name, bill_id, consumer_number FROM students
       WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'active' AND (${selectors.join(' OR ')})`,
      selectorParams
    );
    if (students.length === 0) throw new AppError('No active students matched the selected scope', 404);

    const selectedIds = students.map((student) => student.id);
    const [existingRows] = await connection.query(
      `SELECT ppa.student_id, ppa.fee_plan_id, COALESCE(fp.plan_type, 'tuition') AS plan_type
       FROM payment_plan_assignments ppa
       JOIN fee_plans fp ON fp.id = ppa.fee_plan_id
       WHERE ppa.tenant_id = ? AND ppa.student_id IN (?) AND ppa.status IN ('active', 'pending')`,
      [tenantId, selectedIds]
    );
    const duplicateKeys = new Set(existingRows.map((row) => `${row.student_id}:${row.fee_plan_id}`));
    const tuitionAssigned = new Set(existingRows.filter((row) => row.plan_type === 'tuition').map((row) => row.student_id));
    const eligible = students.filter((student) =>
      !duplicateKeys.has(`${student.id}:${feePlanId}`) &&
      (plan.plan_type !== 'tuition' || !tuitionAssigned.has(student.id))
    );

    const isOneTime = String(plan.frequency || '').toLowerCase() === 'one-time';
    const assignmentStatus = isOneTime ? 'completed' : 'active';
    const nextDueDate = isOneTime ? null : computeNextDueDate(assignedDate, plan.due_day);
    const assignmentValues = eligible.map((student) => [
      uuidv4(), tenantId, student.id, feePlanId, assignmentStatus, assignedVia, assignedDate, nextDueDate,
    ]);

    if (assignmentValues.length > 0) {
      await connection.query(
        `INSERT INTO payment_plan_assignments
         (id, tenant_id, student_id, fee_plan_id, status, assigned_via, assigned_date, next_due_date)
         VALUES ?`,
        [assignmentValues]
      );
    }

    if (eligible.length > 0 && (plan.plan_type === 'additional' || isOneTime)) {
      await lockBillingTenant(connection, tenantId);
      await createInvoiceCharges(connection, tenantId, eligible.map(student => ({
        studentId: student.id, feePlanId, month: assignedDate.slice(0, 7), dueDate: assignedDate,
        amount: plan.amount, description: plan.name,
      })));
    }

    await connection.commit();
    const created = eligible.length;
    const skipped = students.length - created;
    await auditLog(req, 'create', 'payment_plan_assignment_batch', feePlanId, `${plan.name} assigned to ${created} student(s); ${skipped} skipped`);
    await createRequestNotification(req, {
      title: 'Payment plan assignment completed',
      message: `${plan.name} was assigned to ${created} student(s); ${skipped} already assigned or ineligible.`,
      type: 'system',
      tenantId,
    });
    res.status(201).json({ data: { created, skipped, matched: students.length }, message: 'Bulk assignment completed' });
  } catch (err) {
    if (connection) await connection.rollback();
    next(err);
  } finally {
    if (connection) connection.release();
  }
};

const updatePaymentPlanAssignment = async (req, res, next) => {
  let connection;
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) throw new AppError('Tenant ID is required', 400);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.query('SELECT id FROM tenants WHERE id = ? AND deleted_at IS NULL FOR UPDATE', [tenantId]);
    const [[existing]] = await connection.query('SELECT * FROM payment_plan_assignments WHERE id = ? AND tenant_id = ? FOR UPDATE', [req.params.id, tenantId]);
    if (!existing) throw new AppError('Assignment not found', 404);
    if (existing.status === 'completed') throw new AppError('Completed assignments cannot be edited; create a new assignment', 409);
    const planId = req.body.feePlanId || existing.fee_plan_id;
    const [[plan]] = await connection.query('SELECT * FROM fee_plans WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL', [planId, tenantId]);
    if (!plan) throw new AppError('Fee plan not found', 404);
    const status = req.body.status || existing.status;
    if (!['active','pending','completed'].includes(status)) throw new AppError('Invalid assignment status', 400);
    if (['active','pending'].includes(status)) {
      const [[duplicate]] = await connection.query(`SELECT a.id FROM payment_plan_assignments a
        JOIN fee_plans fp ON fp.id = a.fee_plan_id WHERE a.tenant_id = ? AND a.student_id = ? AND a.id != ?
        AND a.status IN ('active','pending') AND (a.fee_plan_id = ? OR (? = 'tuition' AND fp.plan_type = 'tuition')) LIMIT 1`,
      [tenantId, existing.student_id, existing.id, planId, plan.plan_type]);
      if (duplicate) throw new AppError('Student already has this plan or an active tuition assignment', 409);
    }
    const assigned = assertDate(req.body.assignedDate || String(existing.assigned_date).slice(0, 10));
    const changedPlan = planId !== existing.fee_plan_id;
    const due = plan.frequency === 'one-time' ? null : assertDate(req.body.nextDueDate ||
      ((!changedPlan && !req.body.assignedDate && existing.next_due_date) ? String(existing.next_due_date).slice(0, 10) : computeNextDueDate(assigned, plan.due_day)));
    const via = req.body.assignedVia || existing.assigned_via;
    if (!['individual','class'].includes(via)) throw new AppError('Invalid assignment source', 400);
    const immediateCharge = changedPlan && (plan.plan_type === 'additional' || plan.frequency === 'one-time');
    if (immediateCharge) {
      await lockBillingTenant(connection, tenantId);
      await createInvoiceCharges(connection, tenantId, [{studentId: existing.student_id, feePlanId: planId,
        month: assigned.slice(0,7), dueDate: assigned, amount: plan.amount, description: plan.name}]);
    }
    await connection.query(`UPDATE payment_plan_assignments SET fee_plan_id = ?, status = ?, assigned_via = ?, assigned_date = ?, next_due_date = ? WHERE id = ? AND tenant_id = ?`,
      [planId, immediateCharge && plan.frequency === 'one-time' ? 'completed' : status, via, assigned, due, existing.id, tenantId]);
    await connection.commit();
    await auditLog(req, 'update', 'payment_plan_assignment', existing.id, 'Assignment updated');
    const [[updated]] = await connection.query(`SELECT ppa.*, s.name AS student_name, s.consumer_number, s.class AS class_name, s.section AS section_name,
      fp.name AS plan_name, fp.amount, fp.frequency, fp.due_day, fp.plan_type FROM payment_plan_assignments ppa
      JOIN students s ON s.id = ppa.student_id JOIN fee_plans fp ON fp.id = ppa.fee_plan_id WHERE ppa.id = ? AND ppa.tenant_id = ?`, [existing.id, tenantId]);
    res.json({data: updated, message: 'Payment plan assignment updated'});
  } catch (err) { if (connection) await connection.rollback(); next(err); }
  finally { if (connection) connection.release(); }
};

const deletePaymentPlanAssignment = async (req, res, next) => {
  let connection;
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) throw new AppError("Tenant ID is required", 400);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.query("SELECT id FROM tenants WHERE id = ? FOR UPDATE", [tenantId]);
    let where = 'WHERE ppa.id = ?';
    const params = [req.params.id];
    if (req.tenantId) {
      where += ' AND ppa.tenant_id = ?';
      params.push(req.tenantId);
    }

    const [rows] = await connection.query(
      `SELECT ppa.*, s.name as student_name, fp.name as plan_name
       FROM payment_plan_assignments ppa
       JOIN students s ON s.id = ppa.student_id
       JOIN fee_plans fp ON fp.id = ppa.fee_plan_id
       ${where}`,
      params
    );
    if (rows.length === 0) throw new AppError('Payment plan assignment not found', 404);

    await connection.query('DELETE FROM payment_plan_assignments WHERE id = ?', [req.params.id]);
    await connection.commit();
    await auditLog(req, 'delete', 'payment_plan_assignment', req.params.id, `${rows[0].student_name} assignment removed`);

    res.json({ data: true, message: 'Payment plan assignment removed' });
  } catch (err) {
    if (connection) await connection.rollback();
    next(err);
  } finally { if (connection) connection.release(); }
};

const getSetting = async (req, res, next) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) throw new AppError('Tenant ID is required', 400);

    const [rows] = await pool.query(
      'SELECT value FROM settings WHERE tenant_id = ? AND `key` = ? LIMIT 1',
      [tenantId, req.params.key]
    );

    const value = rows.length > 0 ? parseJsonValue(rows[0].value) : null;
    if (req.user?.role === 'org' && req.params.key === 'org_security_context') {
      return res.json({ data: orgSecuritySummary(value) });
    }

    res.json({ data: value });
  } catch (err) {
    next(err);
  }
};

const upsertSetting = async (req, res, next) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) throw new AppError('Tenant ID is required', 400);

    const value = req.body.value;
    if (req.params.key === 'org_security_context') {
      const rawSourceIps = value?.sourceIp;
      const sourceIps = (Array.isArray(rawSourceIps)
        ? rawSourceIps
        : String(rawSourceIps || '').split(','))
        .map((ip) => String(ip).trim())
        .filter(Boolean);
      if (sourceIps.length === 0 || sourceIps.length > 50) {
        throw new AppError('Configure between 1 and 50 source IP addresses', 400);
      }
      if (sourceIps.some((ip) => net.isIP(ip) === 0)) {
        throw new AppError('Every source IP must be a valid IPv4 or IPv6 address', 400);
      }
      value.sourceIp = [...new Set(sourceIps)];
    }
    await pool.query(
      `INSERT INTO settings (id, tenant_id, \`key\`, value)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      [uuidv4(), tenantId, req.params.key, JSON.stringify(value)]
    );

    await auditLog(req, 'update', 'setting', req.params.key, `Setting ${req.params.key} saved`);
    const responseValue = req.user?.role === 'org' && req.params.key === 'org_security_context'
      ? orgSecuritySummary(value)
      : value;
    res.json({ data: responseValue, message: 'Setting saved' });
  } catch (err) {
    next(err);
  }
};

// ---- Webhook Config (per-tenant, stored in tenants.settings JSON column) ----

const parseTenantSettings = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
};

const maskSecret = (secret) => {
  if (!secret || typeof secret !== 'string' || secret.length < 1) return null;
  if (secret.length <= 6) return '••••••';
  return '••••••' + secret.slice(-6);
};

const getWebhookConfig = async (req, res, next) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) throw new AppError('Tenant ID is required', 400);

    const [rows] = await pool.query(
      'SELECT settings FROM tenants WHERE id = ? AND deleted_at IS NULL',
      [tenantId]
    );
    if (rows.length === 0) throw new AppError('Tenant not found', 404);

    const settings = parseTenantSettings(rows[0].settings);
    res.json({
      data: {
        notification_url: settings.notification_url || null,
        webhook_secret_hint: maskSecret(settings.webhook_secret),
      },
    });
  } catch (err) {
    next(err);
  }
};

const saveWebhookConfig = async (req, res, next) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) throw new AppError('Tenant ID is required', 400);

    const { notification_url, webhook_secret } = req.body;

    let safeNotificationUrl;
    try {
      safeNotificationUrl = await assertSafePublicHttpsUrl(notification_url);
    } catch (error) {
      throw new AppError(error.message, 400, 'UNSAFE_WEBHOOK_URL');
    }

    const patch = { notification_url: safeNotificationUrl };
    if (webhook_secret !== undefined && webhook_secret !== '') {
      if (typeof webhook_secret !== 'string' || webhook_secret.length < 32) {
        throw new AppError('Webhook secret must contain at least 32 characters', 400);
      }
      patch.webhook_secret = webhook_secret;
    }

    await pool.query(
      `UPDATE tenants
         SET settings = JSON_MERGE_PATCH(COALESCE(settings, '{}'), ?)
       WHERE id = ? AND deleted_at IS NULL`,
      [JSON.stringify(patch), tenantId]
    );

    await auditLog(req, 'update', 'tenant_webhook_config', tenantId, 'Webhook config updated');
    res.json({ data: { saved: true }, message: 'Webhook configuration saved' });
  } catch (err) {
    next(err);
  }
};

const testWebhookConfig = async (req, res, next) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) throw new AppError('Tenant ID is required', 400);

    const [rows] = await pool.query(
      'SELECT settings FROM tenants WHERE id = ? AND deleted_at IS NULL',
      [tenantId]
    );
    if (rows.length === 0) throw new AppError('Tenant not found', 404);

    const settings = parseTenantSettings(rows[0].settings);
    const notificationUrl = settings.notification_url || '';
    const webhookSecret = settings.webhook_secret || require('../config').org.webhookSecret;

    if (!notificationUrl) {
      throw new AppError('Notification URL is not configured. Save a webhook URL first.', 400);
    }
    let safeNotificationUrl;
    try {
      safeNotificationUrl = await assertSafePublicHttpsUrl(notificationUrl);
    } catch (error) {
      throw new AppError(error.message, 400, 'UNSAFE_WEBHOOK_URL');
    }

    const payload = { schema_version: 1, event_id: uuidv4(), event_type: 'webhook.test', created_at: new Date().toISOString(), data: { status: 'test', applicationId: 'TEST-0000' } };
    const sig = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    try {
      const response = await sendWebhook(safeNotificationUrl, {
          headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': sig,
          'X-Fintap-Event-Id': payload.event_id,
        },
        body: JSON.stringify(payload),
        });
      res.json({ data: { status: response.status, ok: response.ok } });
    } catch (fetchErr) {
      res.json({ data: { status: 0, ok: false, error: fetchErr.message } });
    }
  } catch (err) {
    next(err);
  }
};

module.exports = {
  fetchFeePlans,
  createFeePlan,
  updateFeePlan,
  deleteFeePlan,
  fetchFeeHeads,
  fetchScholarships,
  createScholarship,
  updateScholarshipStatus,
  fetchStudentScholarships,
  fetchAllScholarshipAssignments,
  createScholarshipAssignment,
  bulkCreateScholarshipAssignments,
  updateScholarshipAssignment,
  fetchPaymentPlanAssignments,
  createPaymentPlanAssignment,
  bulkCreatePaymentPlanAssignments,
  updatePaymentPlanAssignment,
  deletePaymentPlanAssignment,
  getSetting,
  upsertSetting,
  getWebhookConfig,
  saveWebhookConfig,
  testWebhookConfig,
};
