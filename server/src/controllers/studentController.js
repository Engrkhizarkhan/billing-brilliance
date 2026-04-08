const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { auditLog } = require('../middleware/auditLog');
const { createRequestNotification } = require('../services/notificationService');

const FINTECH_PREFIX = config.fintechPrefix || '123456';

const generateConsumerNumber = (billerCode, sequence) => {
  return `${FINTECH_PREFIX}${billerCode}${String(sequence).padStart(14, '0')}`;
};

const fetchStudents = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 25, search, className, status } = req.query;
    const offset = (page - 1) * pageSize;

    let where = 'WHERE s.deleted_at IS NULL';
    const params = [];

    if (req.tenantId) {
      where += ' AND s.tenant_id = ?';
      params.push(req.tenantId);
    }

    if (search) {
      where += ' AND (s.name LIKE ? OR s.cnic LIKE ? OR s.roll_number LIKE ? OR s.consumer_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (className) { where += ' AND s.class = ?'; params.push(className); }
    if (status) { where += ' AND s.status = ?'; params.push(status); }

    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM students s ${where}`, params);
    const [rows] = await pool.query(
      `SELECT * FROM students s ${where} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );

    res.json({
      data: rows,
      meta: { page: parseInt(page), pageSize: parseInt(pageSize), total: countRows[0].total },
    });
  } catch (err) {
    next(err);
  }
};

const getStudent = async (req, res, next) => {
  try {
    let where = 'WHERE id = ? AND deleted_at IS NULL';
    const params = [req.params.id];

    if (req.tenantId) {
      where += ' AND tenant_id = ?';
      params.push(req.tenantId);
    }

    const [rows] = await pool.query(`SELECT * FROM students ${where}`, params);
    if (rows.length === 0) throw new AppError('Student not found', 404);

    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
};

const createStudent = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.body.tenantId;
    if (!tenantId) throw new AppError('Tenant ID is required', 400);

    // Get tenant for biller code
    const [tenants] = await pool.query('SELECT biller_code FROM tenants WHERE id = ?', [tenantId]);
    if (tenants.length === 0) throw new AppError('Tenant not found', 404);
    const billerCode = tenants[0].biller_code;

    // Get next sequence for consumer number
    const [seqRows] = await pool.query('SELECT COUNT(*) as cnt FROM students WHERE tenant_id = ?', [tenantId]);
    const seq = seqRows[0].cnt + 1;

    const id = uuidv4();
    const consumerNumber = req.body.consumerNumber || generateConsumerNumber(billerCode, seq);
    const billId = req.body.billId || `SCH-${billerCode}-${String(seq).padStart(5, '0')}`;

    const {
      name, fatherName, rollNumber, class: className, section, phone, cnic,
      status = 'active', balance = 0, admissionDate, gender, dateOfBirth, address,
      usesBusService = false, busServiceStartMonth, busServiceEndMonth, busMonthlyFee = 0,
    } = req.body;

    await pool.query(
      `INSERT INTO students (id, tenant_id, name, father_name, roll_number, class, section, phone, cnic,
        consumer_number, bill_id, status, balance, admission_date, gender, date_of_birth, address,
        uses_bus_service, bus_service_start_month, bus_service_end_month, bus_monthly_fee)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, name, fatherName, rollNumber || null, className, section || null, phone || null, cnic || null,
        consumerNumber, billId, status, balance, admissionDate || null, gender, dateOfBirth || null, address || null,
        usesBusService ? 1 : 0, busServiceStartMonth || null, busServiceEndMonth || null, busMonthlyFee]
    );

    await auditLog(req, 'create', 'student', id, `Student ${name} created`);
    await createRequestNotification(req, {
      title: 'Student created',
      message: `${name} was added to the student directory.`,
      type: 'system',
      tenantId,
    });

    const [rows] = await pool.query('SELECT * FROM students WHERE id = ?', [id]);
    res.status(201).json({ data: rows[0], message: 'Student created' });
  } catch (err) {
    next(err);
  }
};

const updateStudent = async (req, res, next) => {
  try {
    let where = 'WHERE id = ? AND deleted_at IS NULL';
    const params = [req.params.id];

    if (req.tenantId) {
      where += ' AND tenant_id = ?';
      params.push(req.tenantId);
    }

    const [existing] = await pool.query(`SELECT * FROM students ${where}`, params);
    if (existing.length === 0) throw new AppError('Student not found', 404);

    const mapping = {
      name: 'name',
      fatherName: 'father_name',
      rollNumber: 'roll_number',
      class: 'class',
      section: 'section',
      phone: 'phone',
      cnic: 'cnic',
      status: 'status',
      balance: 'balance',
      admissionDate: 'admission_date',
      gender: 'gender',
      dateOfBirth: 'date_of_birth',
      address: 'address',
      usesBusService: 'uses_bus_service',
      busServiceStartMonth: 'bus_service_start_month',
      busServiceEndMonth: 'bus_service_end_month',
      busMonthlyFee: 'bus_monthly_fee',
    };

    const updates = [];
    const values = [];
    for (const [key, column] of Object.entries(mapping)) {
      if (req.body[key] !== undefined) {
        updates.push(`${column} = ?`);
        values.push(key === 'usesBusService' ? (req.body[key] ? 1 : 0) : req.body[key]);
      }
    }

    if (updates.length === 0) throw new AppError('No fields to update', 400);

    values.push(req.params.id);
    await pool.query(`UPDATE students SET ${updates.join(', ')} WHERE id = ?`, values);
    await auditLog(req, 'update', 'student', req.params.id, `Student ${existing[0].name} updated`);
    await createRequestNotification(req, {
      title: 'Student updated',
      message: `${existing[0].name}'s profile was updated.`,
      type: 'system',
    });

    const [rows] = await pool.query('SELECT * FROM students WHERE id = ?', [req.params.id]);
    res.json({ data: rows[0], message: 'Student updated' });
  } catch (err) {
    next(err);
  }
};

const deleteStudent = async (req, res, next) => {
  try {
    let where = 'WHERE id = ? AND deleted_at IS NULL';
    const params = [req.params.id];

    if (req.tenantId) {
      where += ' AND tenant_id = ?';
      params.push(req.tenantId);
    }

    const [existing] = await pool.query(`SELECT * FROM students ${where}`, params);
    if (existing.length === 0) throw new AppError('Student not found', 404);

    await pool.query('UPDATE students SET deleted_at = NOW(), status = ? WHERE id = ?', ['inactive', req.params.id]);
    await auditLog(req, 'delete', 'student', req.params.id, `Student ${existing[0].name} deleted`);
    await createRequestNotification(req, {
      title: 'Student archived',
      message: `${existing[0].name} was removed from active records.`,
      type: 'alert',
    });

    res.json({ data: true, message: 'Student deleted' });
  } catch (err) {
    next(err);
  }
};

const updateStudentBusService = async (req, res, next) => {
  try {
    const { usesBusService, busServiceStartMonth, busServiceEndMonth, busMonthlyFee } = req.body;

    let where = 'WHERE id = ? AND deleted_at IS NULL';
    const checkParams = [req.params.id];
    if (req.tenantId) { where += ' AND tenant_id = ?'; checkParams.push(req.tenantId); }

    const [existing] = await pool.query(`SELECT id FROM students ${where}`, checkParams);
    if (existing.length === 0) throw new AppError('Student not found', 404);

    await pool.query(
      `UPDATE students SET uses_bus_service = ?, bus_service_start_month = ?, bus_service_end_month = ?, bus_monthly_fee = ?
       WHERE id = ?`,
      [usesBusService ? 1 : 0, busServiceStartMonth || null, busServiceEndMonth || null, busMonthlyFee || 0, req.params.id]
    );

    await auditLog(req, 'update', 'student', req.params.id, 'Bus service updated');

    const [rows] = await pool.query('SELECT * FROM students WHERE id = ?', [req.params.id]);
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
};

const getStudentLedger = async (req, res, next) => {
  try {
    let where = 'WHERE le.student_id = ?';
    const params = [req.params.id];
    if (req.tenantId) { where += ' AND le.tenant_id = ?'; params.push(req.tenantId); }

    const [rows] = await pool.query(
      `SELECT * FROM ledger_entries le ${where} ORDER BY le.date ASC, le.created_at ASC`,
      params
    );

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const getStudentSnapshot = async (req, res, next) => {
  try {
    const studentId = req.params.id;

    // Verify student exists and tenant scoping
    let where = 'WHERE id = ? AND deleted_at IS NULL';
    const checkParams = [studentId];
    if (req.tenantId) { where += ' AND tenant_id = ?'; checkParams.push(req.tenantId); }

    const [studentRows] = await pool.query(`SELECT * FROM students ${where}`, checkParams);
    if (studentRows.length === 0) throw new AppError('Student not found', 404);

    // Calculate overdue months (unpaid invoices whose due_date has passed)
    const [overdueRows] = await pool.query(
      `SELECT COUNT(DISTINCT month) as overdue_months
       FROM invoices WHERE consumer_number = ? AND status != 'paid' AND due_date < NOW() AND deleted_at IS NULL`,
      [studentRows[0].consumer_number]
    );
    const overdueMonths = overdueRows[0].overdue_months || 0;

    // Total due
    const [dueRows] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total_due
       FROM invoices WHERE consumer_number = ? AND status != 'paid' AND deleted_at IS NULL`,
      [studentRows[0].consumer_number]
    );
    const totalDue = parseFloat(dueRows[0].total_due) || 0;

    // Last payment date
    const [lastPayRows] = await pool.query(
      `SELECT MAX(date) as last_payment_date FROM payments WHERE student_id = ?`,
      [studentId]
    );

    // Scholarship count
    const [schRows] = await pool.query(
      `SELECT COUNT(*) as cnt FROM student_scholarship_assignments WHERE student_id = ? AND status = 'active'`,
      [studentId]
    );

    const riskTier = overdueMonths >= 5 ? 'critical' : overdueMonths >= 3 ? 'high-risk' : overdueMonths >= 1 ? 'watch' : 'current';

    res.json({
      data: {
        studentId,
        overdueMonths,
        totalDue,
        lastPaymentDate: lastPayRows[0].last_payment_date || null,
        scholarshipCount: schRows[0].cnt,
        riskTier,
      },
    });
  } catch (err) {
    next(err);
  }
};

const fetchStudentFinancialSummary = async (req, res, next) => {
  try {
    let tenantFilter = '';
    const params = [];
    if (req.tenantId) {
      tenantFilter = 'AND tenant_id = ?';
      params.push(req.tenantId);
    }

    // One DB query: aggregate total due and distinct overdue months per student
    const [rows] = await pool.query(
      `SELECT
         student_id,
         CAST(COALESCE(SUM(CASE WHEN status != 'paid' THEN amount ELSE 0 END), 0) AS DECIMAL(15,2)) AS total_due,
         COUNT(DISTINCT CASE WHEN status != 'paid' AND due_date < NOW() THEN month END) AS overdue_months
       FROM invoices
       WHERE deleted_at IS NULL ${tenantFilter}
       GROUP BY student_id`,
      params
    );

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  fetchStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  updateStudentBusService,
  getStudentLedger,
  getStudentSnapshot,
  fetchStudentFinancialSummary,
};
