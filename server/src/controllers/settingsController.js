const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { auditLog } = require('../middleware/auditLog');
const { createRequestNotification } = require('../services/notificationService');

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

const clampDateToMonth = (year, monthIndex, day) => {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(Math.max(day, 1), lastDay));
};

const computeNextDueDate = (assignedDate, dueDay) => {
  const baseDate = assignedDate ? new Date(`${assignedDate}T00:00:00`) : new Date();
  if (Number.isNaN(baseDate.getTime())) {
    return null;
  }

  let dueDate = clampDateToMonth(baseDate.getFullYear(), baseDate.getMonth(), Number(dueDay) || 1);
  if (dueDate < baseDate) {
    const nextMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
    dueDate = clampDateToMonth(nextMonth.getFullYear(), nextMonth.getMonth(), Number(dueDay) || 1);
  }

  return dueDate.toISOString().slice(0, 10);
};

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

    const { name, amount, frequency, dueDay = 10, lateFee = 0 } = req.body;
    if (!name || amount === undefined || !frequency) {
      throw new AppError('Name, amount, and frequency are required', 400);
    }

    const id = uuidv4();
    await pool.query(
      `INSERT INTO fee_plans (id, tenant_id, name, amount, frequency, due_day, late_fee)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, name, amount, frequency, dueDay, lateFee]
    );

    await auditLog(req, 'create', 'fee_plan', id, `Fee plan ${name} created`);
    await createRequestNotification(req, {
      title: 'Fee plan created',
      message: `${name} is now available for assignments and invoice generation.`,
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

    const { name, amount, frequency, dueDay, lateFee } = req.body;
    await pool.query(
      `UPDATE fee_plans SET name = COALESCE(?, name), amount = COALESCE(?, amount),
       frequency = COALESCE(?, frequency), due_day = COALESCE(?, due_day),
       late_fee = COALESCE(?, late_fee) WHERE id = ?`,
      [name ?? null, amount ?? null, frequency ?? null, dueDay ?? null, lateFee ?? null, id]
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
              fp.name as plan_name, fp.amount, fp.frequency, fp.due_day
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

    const [students] = await pool.query(
      'SELECT id, name FROM students WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL',
      [studentId, tenantId]
    );
    if (students.length === 0) throw new AppError('Student not found', 404);

    const [plans] = await pool.query(
      'SELECT id, name, due_day FROM fee_plans WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL',
      [feePlanId, tenantId]
    );
    if (plans.length === 0) throw new AppError('Fee plan not found', 404);

    const [duplicates] = await pool.query(
      `SELECT id FROM payment_plan_assignments
       WHERE student_id = ? AND fee_plan_id = ? AND status IN ('active', 'pending')`,
      [studentId, feePlanId]
    );
    if (duplicates.length > 0) {
      throw new AppError('Student already has this fee plan assigned', 409);
    }

    const id = uuidv4();
    const resolvedAssignedDate = assignedDate || new Date().toISOString().slice(0, 10);
    const resolvedNextDueDate = nextDueDate || computeNextDueDate(resolvedAssignedDate, plans[0].due_day);

    await pool.query(
      `INSERT INTO payment_plan_assignments (id, tenant_id, student_id, fee_plan_id, status, assigned_via, assigned_date, next_due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, studentId, feePlanId, status, assignedVia, resolvedAssignedDate, resolvedNextDueDate]
    );

    await auditLog(req, 'create', 'payment_plan_assignment', id, `${students[0].name} assigned ${plans[0].name}`);
    await createRequestNotification(req, {
      title: 'Payment plan assigned',
      message: `${students[0].name} was assigned ${plans[0].name}.`,
      type: 'system',
      tenantId,
    });

    const [rows] = await pool.query(
      `SELECT ppa.*, s.name as student_name, s.consumer_number, s.class as class_name, s.section as section_name,
              fp.name as plan_name, fp.amount, fp.frequency, fp.due_day
       FROM payment_plan_assignments ppa
       JOIN students s ON s.id = ppa.student_id
       JOIN fee_plans fp ON fp.id = ppa.fee_plan_id
       WHERE ppa.id = ?`,
      [id]
    );

    res.status(201).json({ data: rows[0], message: 'Payment plan assigned' });
  } catch (err) {
    next(err);
  }
};

const updatePaymentPlanAssignment = async (req, res, next) => {
  try {
    let where = 'WHERE ppa.id = ?';
    const params = [req.params.id];
    if (req.tenantId) {
      where += ' AND ppa.tenant_id = ?';
      params.push(req.tenantId);
    }

    const [rows] = await pool.query(
      `SELECT ppa.*, s.name as student_name, fp.name as plan_name, fp.due_day
       FROM payment_plan_assignments ppa
       JOIN students s ON s.id = ppa.student_id
       JOIN fee_plans fp ON fp.id = ppa.fee_plan_id
       ${where}`,
      params
    );
    if (rows.length === 0) throw new AppError('Payment plan assignment not found', 404);

    const updates = [];
    const values = [];
    let dueDay = rows[0].due_day;

    if (req.body.feePlanId !== undefined) {
      const [plans] = await pool.query(
        'SELECT id, due_day FROM fee_plans WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL',
        [req.body.feePlanId, req.tenantId]
      );
      if (plans.length === 0) throw new AppError('Fee plan not found', 404);
      dueDay = plans[0].due_day;
      updates.push('fee_plan_id = ?');
      values.push(req.body.feePlanId);
    }
    if (req.body.status !== undefined) {
      updates.push('status = ?');
      values.push(req.body.status);
    }
    if (req.body.assignedVia !== undefined) {
      updates.push('assigned_via = ?');
      values.push(req.body.assignedVia);
    }
    if (req.body.assignedDate !== undefined) {
      updates.push('assigned_date = ?');
      values.push(req.body.assignedDate);
    }

    const resolvedAssignedDate = req.body.assignedDate || rows[0].assigned_date;
    const resolvedNextDueDate = req.body.nextDueDate || computeNextDueDate(resolvedAssignedDate, dueDay);
    updates.push('next_due_date = ?');
    values.push(resolvedNextDueDate);

    if (updates.length === 0) throw new AppError('No fields to update', 400);

    values.push(req.params.id);
    await pool.query(`UPDATE payment_plan_assignments SET ${updates.join(', ')} WHERE id = ?`, values);
    await auditLog(req, 'update', 'payment_plan_assignment', req.params.id, `${rows[0].student_name} assignment updated`);

    const [updated] = await pool.query(
      `SELECT ppa.*, s.name as student_name, s.consumer_number, s.class as class_name, s.section as section_name,
              fp.name as plan_name, fp.amount, fp.frequency, fp.due_day
       FROM payment_plan_assignments ppa
       JOIN students s ON s.id = ppa.student_id
       JOIN fee_plans fp ON fp.id = ppa.fee_plan_id
       WHERE ppa.id = ?`,
      [req.params.id]
    );

    res.json({ data: updated[0], message: 'Payment plan assignment updated' });
  } catch (err) {
    next(err);
  }
};

const deletePaymentPlanAssignment = async (req, res, next) => {
  try {
    let where = 'WHERE ppa.id = ?';
    const params = [req.params.id];
    if (req.tenantId) {
      where += ' AND ppa.tenant_id = ?';
      params.push(req.tenantId);
    }

    const [rows] = await pool.query(
      `SELECT ppa.*, s.name as student_name, fp.name as plan_name
       FROM payment_plan_assignments ppa
       JOIN students s ON s.id = ppa.student_id
       JOIN fee_plans fp ON fp.id = ppa.fee_plan_id
       ${where}`,
      params
    );
    if (rows.length === 0) throw new AppError('Payment plan assignment not found', 404);

    await pool.query('DELETE FROM payment_plan_assignments WHERE id = ?', [req.params.id]);
    await auditLog(req, 'delete', 'payment_plan_assignment', req.params.id, `${rows[0].student_name} assignment removed`);

    res.json({ data: true, message: 'Payment plan assignment removed' });
  } catch (err) {
    next(err);
  }
};

const getSetting = async (req, res, next) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) throw new AppError('Tenant ID is required', 400);

    const [rows] = await pool.query(
      'SELECT value FROM settings WHERE tenant_id = ? AND `key` = ? LIMIT 1',
      [tenantId, req.params.key]
    );

    res.json({ data: rows.length > 0 ? parseJsonValue(rows[0].value) : null });
  } catch (err) {
    next(err);
  }
};

const upsertSetting = async (req, res, next) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) throw new AppError('Tenant ID is required', 400);

    const value = req.body.value;
    await pool.query(
      `INSERT INTO settings (id, tenant_id, \`key\`, value)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      [uuidv4(), tenantId, req.params.key, JSON.stringify(value)]
    );

    await auditLog(req, 'update', 'setting', req.params.key, `Setting ${req.params.key} saved`);
    res.json({ data: value, message: 'Setting saved' });
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
  updateScholarshipAssignment,
  fetchPaymentPlanAssignments,
  createPaymentPlanAssignment,
  updatePaymentPlanAssignment,
  deletePaymentPlanAssignment,
  getSetting,
  upsertSetting,
};
