const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { auditLog } = require('../middleware/auditLog');
const { createRequestNotification } = require('../services/notificationService');

const FINTECH_PREFIX = config.fintechPrefix || '123456';

const generateConsumerNumber = (billerCode, sequence) => {
  const prefix = String(FINTECH_PREFIX);
  const code = String(billerCode);
  const sequenceWidth = 20 - prefix.length - code.length;
  if (sequenceWidth < 1 || String(sequence).length > sequenceWidth) {
    throw new AppError('Unable to generate a 1BILL-compatible 20-digit consumer number', 500, 'CONSUMER_NUMBER_EXHAUSTED');
  }
  return `${prefix}${code}${String(sequence).padStart(sequenceWidth, '0')}`;
};

const fetchStudents = async (req, res, next) => {
  try {
    const {
      page = 1, pageSize = 25, search, className, section, status,
      defaulter, risk, scholarship,
    } = req.query;
    const parsedPage = Number(page);
    const parsedPageSize = Number(pageSize);
    const offset = (parsedPage - 1) * parsedPageSize;

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
    if (section) { where += ' AND s.section = ?'; params.push(section); }
    if (status) { where += ' AND s.status = ?'; params.push(status); }

    if (defaulter === 'with_due') where += ' AND COALESCE(fin.total_due, 0) > 0';
    if (defaulter === 'due_3plus') where += ' AND COALESCE(fin.overdue_months, 0) >= 3';
    if (scholarship === 'with') where += ' AND COALESCE(sch.scholarship_count, 0) > 0';
    if (scholarship === 'without') where += ' AND COALESCE(sch.scholarship_count, 0) = 0';
    if (risk === 'current') where += ' AND COALESCE(fin.overdue_months, 0) = 0';
    if (risk === 'watch') where += ' AND COALESCE(fin.overdue_months, 0) = 1';
    if (risk === 'high-risk') where += ' AND COALESCE(fin.overdue_months, 0) = 2';
    if (risk === 'critical') where += ' AND COALESCE(fin.overdue_months, 0) >= 3';

    const joins = `
      LEFT JOIN (
        SELECT tenant_id, student_id,
          SUM(CASE WHEN status != 'paid' THEN amount ELSE 0 END) AS total_due,
          COUNT(DISTINCT CASE WHEN status != 'paid' AND due_date < CURDATE() THEN month END) AS overdue_months
        FROM invoices
        WHERE deleted_at IS NULL
        GROUP BY tenant_id, student_id
      ) fin ON fin.student_id = s.id AND fin.tenant_id = s.tenant_id
      LEFT JOIN (
        SELECT tenant_id, student_id, COUNT(*) AS scholarship_count
        FROM student_scholarship_assignments
        WHERE status = 'active'
        GROUP BY tenant_id, student_id
      ) sch ON sch.student_id = s.id AND sch.tenant_id = s.tenant_id
      LEFT JOIN (
        SELECT tenant_id, student_id, DATE_FORMAT(MAX(date), '%Y-%m-%d') AS last_payment_date
        FROM payments
        GROUP BY tenant_id, student_id
      ) pay ON pay.student_id = s.id AND pay.tenant_id = s.tenant_id`;

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total, COALESCE(SUM(fin.total_due), 0) AS filtered_total_due
       FROM students s ${joins} ${where}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT s.*,
          COALESCE(fin.total_due, 0) AS total_due,
          COALESCE(fin.overdue_months, 0) AS overdue_months,
          pay.last_payment_date,
          COALESCE(sch.scholarship_count, 0) AS scholarship_count,
          CASE
            WHEN COALESCE(fin.overdue_months, 0) >= 3 THEN 'critical'
            WHEN COALESCE(fin.overdue_months, 0) = 2 THEN 'high-risk'
            WHEN COALESCE(fin.overdue_months, 0) = 1 THEN 'watch'
            ELSE 'current'
          END AS risk_tier
       FROM students s ${joins} ${where}
       ORDER BY s.created_at DESC, s.id DESC LIMIT ? OFFSET ?`,
      [...params, parsedPageSize, offset]
    );

    const facetParams = req.tenantId ? [req.tenantId] : [];
    const facetTenantWhere = req.tenantId ? 'AND tenant_id = ?' : '';
    const [facetRows] = await pool.query(
      `SELECT class AS class_name, section, COUNT(*) AS count
       FROM students
       WHERE deleted_at IS NULL ${facetTenantWhere}
       GROUP BY class, section
       ORDER BY class, section`,
      facetParams
    );
    const classMap = new Map();
    for (const row of facetRows) {
      if (!classMap.has(row.class_name)) classMap.set(row.class_name, { name: row.class_name, count: 0, sections: [] });
      const entry = classMap.get(row.class_name);
      const count = Number(row.count);
      entry.count += count;
      entry.sections.push({ name: row.section || '-', count });
    }

    res.json({
      data: rows,
      meta: {
        page: parsedPage,
        pageSize: parsedPageSize,
        total: Number(countRows[0].total),
        filteredTotalDue: Number(countRows[0].filtered_total_due),
        facets: {
          totalStudents: Array.from(classMap.values()).reduce((sum, item) => sum + item.count, 0),
          classes: Array.from(classMap.values()),
        },
      },
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

    // Get sequence — use MAX()+1 inside a transaction to avoid race conditions
    const conn = await pool.getConnection();
    let seq, id, consumerNumber, billId;
    try {
      await conn.beginTransaction();
      await conn.query('SELECT id FROM tenants WHERE id = ? FOR UPDATE', [tenantId]);
      const [[seqRow]] = await conn.query(
        'SELECT COALESCE(MAX(seq_number), 0) + 1 AS next_seq FROM students WHERE tenant_id = ?',
        [tenantId]
      );
      seq = seqRow.next_seq;
      consumerNumber = req.body.consumerNumber || generateConsumerNumber(billerCode, seq);
      if (!/^\d{1,24}$/.test(consumerNumber) || !consumerNumber.startsWith(String(FINTECH_PREFIX))) {
        throw new AppError(`Consumer number must be numeric, at most 24 digits, and start with ${FINTECH_PREFIX}`, 400, 'INVALID_CONSUMER_NUMBER');
      }
      billId = req.body.billId || `SCH-${billerCode}-${String(seq).padStart(5, '0')}`;

      id = uuidv4();
      const {
        name, fatherName, rollNumber, class: className, section, phone, cnic,
        status = 'active', balance = 0, admissionDate, gender, dateOfBirth, address,
        usesBusService = false, busServiceStartMonth, busServiceEndMonth, busMonthlyFee = 0,
      } = req.body;

      await conn.query(
        `INSERT INTO students (id, tenant_id, name, father_name, roll_number, class, section, phone, cnic,
          consumer_number, bill_id, seq_number, status, balance, admission_date, gender, date_of_birth, address,
          uses_bus_service, bus_service_start_month, bus_service_end_month, bus_monthly_fee)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, tenantId, name, fatherName, rollNumber || null, className, section || null, phone || null, cnic || null,
          consumerNumber, billId, seq, status, balance, admissionDate || null, gender, dateOfBirth || null, address || null,
          usesBusService ? 1 : 0, busServiceStartMonth || null, busServiceEndMonth || null, busMonthlyFee]
      );

      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      conn.release();
      throw txErr;
    }
    conn.release();

    await auditLog(req, 'create', 'student', id, `Student created`);
    await createRequestNotification(req, {
      title: 'Student created',
      message: `Student was added to the student directory.`,
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

    const riskTier = overdueMonths >= 3 ? 'critical' : overdueMonths >= 2 ? 'high-risk' : overdueMonths >= 1 ? 'watch' : 'current';

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

    // Aggregate total due + overdue months from invoices, last payment date from payments
    const [rows] = await pool.query(
      `SELECT
         i.student_id,
         CAST(COALESCE(SUM(CASE WHEN i.status != 'paid' THEN i.amount ELSE 0 END), 0) AS DECIMAL(15,2)) AS total_due,
         COUNT(DISTINCT CASE WHEN i.status != 'paid' AND i.due_date < NOW() THEN i.month END) AS overdue_months,
         (SELECT DATE_FORMAT(MAX(p.date), '%Y-%m-%d')
          FROM payments p
          WHERE p.student_id = i.student_id ${req.tenantId ? 'AND p.tenant_id = ?' : ''}
         ) AS last_payment_date
       FROM invoices i
       WHERE i.deleted_at IS NULL ${tenantFilter}
       GROUP BY i.student_id`,
      req.tenantId ? [...params, req.tenantId] : params
    );

    res.json({
      data: rows.map((r) => ({
        studentId: r.student_id,
        totalDue: parseFloat(r.total_due),
        overdueMonths: Number(r.overdue_months),
        lastPaymentDate: r.last_payment_date || null,
      })),
    });
  } catch (err) {
    next(err);
  }
};

const ADDITIONAL_CHARGE_LABELS = {
  gym: 'Gym Fee',
  books: 'Books Fee',
  stationery: 'Stationery Fee',
  library: 'Library Fee',
  sports: 'Sports Fee',
  transport: 'Transport Fee',
  others: 'Other Charges',
};

const createAdditionalCharge = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) throw new AppError('Tenant ID is required', 400);

    const studentId = req.params.id;
    const { chargeType, description, amount, date } = req.body;

    if (!chargeType || amount === undefined) {
      throw new AppError('chargeType and amount are required', 400);
    }

    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      throw new AppError('Amount must be a positive number', 400);
    }

    const validTypes = Object.keys(ADDITIONAL_CHARGE_LABELS);
    if (!validTypes.includes(chargeType)) {
      throw new AppError(`chargeType must be one of: ${validTypes.join(', ')}`, 400);
    }

    const [students] = await pool.query(
      'SELECT id, name, bill_id, consumer_number FROM students WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL',
      [studentId, tenantId]
    );
    if (!students.length) throw new AppError('Student not found', 404);

    const student = students[0];
    const chargeDate = date || new Date().toISOString().slice(0, 10);
    const chargeLabel = ADDITIONAL_CHARGE_LABELS[chargeType];
    const chargeDescription = description?.trim() ? description.trim() : chargeLabel;

    // Running balance from last ledger entry
    const [lastEntry] = await pool.query(
      'SELECT balance FROM ledger_entries WHERE student_id = ? ORDER BY date DESC, created_at DESC LIMIT 1',
      [studentId]
    );
    const prevBalance = lastEntry.length ? parseFloat(lastEntry[0].balance) : 0;
    const newBalance = prevBalance + parsedAmount;

    const id = uuidv4();
    await pool.query(
      `INSERT INTO ledger_entries (id, tenant_id, student_id, date, description, debit, credit, balance, bill_id, entry_type)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'charge')`,
      [id, tenantId, studentId, chargeDate, chargeDescription, parsedAmount, newBalance, student.bill_id]
    );

    await pool.query('UPDATE students SET balance = balance + ? WHERE id = ?', [parsedAmount, studentId]);
    await auditLog(req, 'create', 'ledger_entry', id,
      `Additional charge (${chargeLabel}): ${chargeDescription} - PKR ${parsedAmount} for ${student.name}`);

    const [rows] = await pool.query('SELECT * FROM ledger_entries WHERE id = ?', [id]);
    res.status(201).json({ data: rows[0], message: `${chargeLabel} posted to ledger` });
  } catch (err) {
    next(err);
  }
};

const fetchStudentLedgerSummary = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 25, search, className } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

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
    if (className) {
      where += ' AND s.class = ?';
      params.push(className);
    }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM students s ${where}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT
         s.id, s.name, s.class, s.section, s.roll_number, s.consumer_number, s.bill_id, s.status,
         COALESCE(SUM(le.debit), 0) AS total_debit,
         COALESCE(SUM(le.credit), 0) AS total_credit,
         COALESCE((
           SELECT balance FROM ledger_entries
           WHERE student_id = s.id
           ORDER BY date DESC, created_at DESC LIMIT 1
         ), 0) AS running_balance,
         COUNT(le.id) AS entry_count
       FROM students s
       LEFT JOIN ledger_entries le ON le.student_id = s.id
       ${where}
       GROUP BY s.id, s.name, s.class, s.section, s.roll_number, s.consumer_number, s.bill_id, s.status
       ORDER BY s.name ASC
       LIMIT ? OFFSET ?`,
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
  fetchStudentLedgerSummary,
  createAdditionalCharge,
};
