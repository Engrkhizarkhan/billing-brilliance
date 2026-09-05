const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { auditLog } = require('../middleware/auditLog');
const { createRequestNotification } = require('../services/notificationService');

const fetchInvoices = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 25, status, search, billerId, className } = req.query;
    const offset = (page - 1) * pageSize;

    let where = 'WHERE i.deleted_at IS NULL';
    const params = [];

    if (req.tenantId) { where += ' AND i.tenant_id = ?'; params.push(req.tenantId); }
    if (status) { where += ' AND i.status = ?'; params.push(status); }
    if (billerId) { where += ' AND i.tenant_id = ?'; params.push(billerId); }
    if (className) { where += ' AND s.class = ?'; params.push(className); }
    if (search) {
      where += ' AND (i.invoice_number LIKE ? OR i.student_name LIKE ? OR i.consumer_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const joins = 'LEFT JOIN students s ON s.id = i.student_id AND s.deleted_at IS NULL';
    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM invoices i ${joins} ${where}`, params);
    const [rows] = await pool.query(
      `SELECT i.*, s.class AS class_name, s.section FROM invoices i ${joins} ${where}
       ORDER BY i.created_at DESC, i.id DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );
    const facetWhere = req.tenantId ? 'AND tenant_id = ?' : '';
    const [classRows] = await pool.query(
      `SELECT class, COUNT(*) AS count FROM students
       WHERE deleted_at IS NULL ${facetWhere} GROUP BY class ORDER BY class`,
      req.tenantId ? [req.tenantId] : []
    );

    res.json({
      data: rows,
      meta: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: Number(countRows[0].total),
        classes: classRows.map((row) => ({ name: row.class, count: Number(row.count) })),
      },
    });
  } catch (err) {
    next(err);
  }
};

const getInvoice = async (req, res, next) => {
  try {
    let where = 'WHERE id = ? AND deleted_at IS NULL';
    const params = [req.params.id];
    if (req.tenantId) { where += ' AND tenant_id = ?'; params.push(req.tenantId); }

    const [rows] = await pool.query(`SELECT * FROM invoices ${where}`, params);
    if (rows.length === 0) throw new AppError('Invoice not found', 404);

    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
};

const createInvoice = async (req, res, next) => {
  let connection;
  try {
    const tenantId = req.tenantId || req.body.tenantId;
    if (!tenantId) throw new AppError('Tenant ID is required', 400);

    const { studentId, studentName, consumerNumber, month, amount, dueDate } = req.body;

    connection = await pool.getConnection();
    await connection.beginTransaction();
    // Serialize numbering per tenant so concurrent manual/batch runs cannot collide.
    await connection.query('SELECT id FROM tenants WHERE id = ? FOR UPDATE', [tenantId]);
    const [seqRows] = await connection.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(invoice_number, '-', -1) AS UNSIGNED)), 10000) AS max_seq
       FROM invoices WHERE tenant_id = ?`,
      [tenantId]
    );
    const invoiceNumber = `INV-${String(Number(seqRows[0].max_seq) + 1)}`;

    const id = uuidv4();
    await connection.query(
      `INSERT INTO invoices (id, tenant_id, invoice_number, student_id, student_name, consumer_number, month, amount, status, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [id, tenantId, invoiceNumber, studentId || null, studentName, consumerNumber, month, amount, dueDate]
    );
    await connection.commit();

    await auditLog(req, 'create', 'invoice', id, `Invoice ${invoiceNumber} for ${amount}`);
    await createRequestNotification(req, {
      title: 'Invoice created',
      message: `Invoice ${invoiceNumber} was generated for ${studentName}.`,
      type: 'system',
      tenantId,
    });

    const [rows] = await pool.query('SELECT * FROM invoices WHERE id = ?', [id]);
    res.status(201).json({ data: rows[0], message: 'Invoice created' });
  } catch (err) {
    if (connection) await connection.rollback();
    next(err);
  } finally {
    if (connection) connection.release();
  }
};

const updateInvoiceStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['pending', 'paid', 'overdue'].includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    let where = 'WHERE id = ? AND deleted_at IS NULL';
    const params = [req.params.id];
    if (req.tenantId) { where += ' AND tenant_id = ?'; params.push(req.tenantId); }

    const [existing] = await pool.query(`SELECT * FROM invoices ${where}`, params);
    if (existing.length === 0) throw new AppError('Invoice not found', 404);

    const now = new Date();
    await pool.query(
      `UPDATE invoices SET status = ?, paid_at = ? WHERE id = ?`,
      [status, status === 'paid' ? now : null, req.params.id]
    );

    // Apply late fee charge to ledger when manually marking paid after due date
    if (status === 'paid') {
      const inv = existing[0];
      const lateFeeAmt = parseFloat(inv.late_fee || 0);
      const dueDate = new Date(inv.due_date);
      if (lateFeeAmt > 0 && now > dueDate && !inv.late_fee_applied) {
        const monthLabel = (inv.month || String(inv.due_date).slice(0, 7));
        const studentId = inv.student_id;
        const tId = req.tenantId || inv.tenant_id;

        const [lastBal] = await pool.query(
          'SELECT balance FROM ledger_entries WHERE student_id = ? ORDER BY date DESC, created_at DESC LIMIT 1',
          [studentId]
        );
        const prevBalance = lastBal.length ? parseFloat(lastBal[0].balance) : 0;
        const lateFeeBalance = parseFloat((prevBalance + lateFeeAmt).toFixed(2));

        await pool.query(
          `INSERT INTO ledger_entries (id, tenant_id, student_id, date, description, debit, credit, balance, reference, entry_type)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'late_fee')`,
          [uuidv4(), tId, studentId, now.toISOString().slice(0, 10),
           `Late Fee — ${monthLabel}`, lateFeeAmt, lateFeeBalance, inv.invoice_number]
        );
        await pool.query('UPDATE invoices SET late_fee_applied = 1 WHERE id = ?', [req.params.id]);
      }
    }

    await auditLog(req, 'update', 'invoice', req.params.id, `Invoice status → ${status}`);
    await createRequestNotification(req, {
      title: 'Invoice status updated',
      message: `Invoice ${existing[0].invoice_number} is now ${status}.`,
      type: status === 'overdue' ? 'alert' : 'system',
    });

    const [rows] = await pool.query('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
    res.json({ data: rows[0], message: 'Invoice updated' });
  } catch (err) {
    next(err);
  }
};

const deleteInvoice = async (req, res, next) => {
  try {
    let where = 'WHERE id = ? AND deleted_at IS NULL';
    const params = [req.params.id];
    if (req.tenantId) { where += ' AND tenant_id = ?'; params.push(req.tenantId); }

    const [existing] = await pool.query(`SELECT * FROM invoices ${where}`, params);
    if (existing.length === 0) throw new AppError('Invoice not found', 404);

    if (existing[0].status !== 'pending') {
      throw new AppError('Only pending invoices can be deleted', 400);
    }

    await pool.query('UPDATE invoices SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
    await auditLog(req, 'delete', 'invoice', req.params.id, `Invoice ${existing[0].invoice_number} deleted`);

    res.json({ data: true, message: `Invoice ${existing[0].invoice_number} deleted` });
  } catch (err) {
    next(err);
  }
};


const generateInvoicesFromAssignments = async (req, res, next) => {
  let connection;
  try {
    const tenantId = req.tenantId || req.body.tenantId;
    if (!tenantId) throw new AppError('Tenant ID is required', 400);

    const month = String(req.body.month || new Date().toISOString().slice(0, 7));
    connection = await pool.getConnection();
    await connection.beginTransaction();
    // One generator per tenant at a time: prevents duplicate month/plan rows and
    // guarantees that the corresponding ledger entries commit atomically.
    await connection.query('SELECT id FROM tenants WHERE id = ? FOR UPDATE', [tenantId]);

    const [assignmentRows] = await connection.query(
      `SELECT ppa.id as assignment_id, ppa.student_id, ppa.next_due_date, s.name as student_name, s.consumer_number,
              fp.id as fee_plan_id, fp.name as fee_plan_name, fp.amount, fp.due_day, fp.late_fee, fp.frequency,
              s.uses_bus_service, s.bus_service_start_month, s.bus_service_end_month, s.bus_monthly_fee
       FROM payment_plan_assignments ppa
       JOIN students s ON s.id = ppa.student_id AND s.deleted_at IS NULL
       JOIN fee_plans fp ON fp.id = ppa.fee_plan_id AND fp.deleted_at IS NULL
       WHERE ppa.tenant_id = ? AND ppa.status = 'active'
         AND (fp.plan_type = 'tuition' OR fp.plan_type IS NULL)`,
      [tenantId]
    );

    const [seqRows] = await connection.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(invoice_number, '-', -1) AS UNSIGNED)), 10000) AS max_seq
       FROM invoices WHERE tenant_id = ?`,
      [tenantId]
    );
    let counter = Number(seqRows[0].max_seq);
    let created = 0;
    let skipped = 0;

    // Preload all batch dependencies. This holds database round-trips roughly
    // constant as enrolment grows instead of issuing several queries per pupil.
    const [existingRows] = await connection.query(
      `SELECT student_id, fee_plan_id FROM invoices
       WHERE tenant_id = ? AND month = ? AND deleted_at IS NULL`,
      [tenantId, month]
    );
    const existingKeys = new Set(existingRows.map((row) => `${row.student_id}:${row.fee_plan_id}`));

    const [balanceRows] = await connection.query(
      `SELECT student_id,
              CAST(SUBSTRING_INDEX(GROUP_CONCAT(balance ORDER BY date DESC, created_at DESC), ',', 1) AS DECIMAL(12,2)) AS balance
       FROM ledger_entries WHERE tenant_id = ? GROUP BY student_id`,
      [tenantId]
    );
    const studentBalances = Object.fromEntries(balanceRows.map((row) => [row.student_id, Number(row.balance || 0)]));

    const [scholarshipRows] = await connection.query(
      `SELECT ssa.student_id, s.type, s.value
       FROM student_scholarship_assignments ssa
       JOIN scholarships s ON s.id = ssa.scholarship_id AND s.deleted_at IS NULL
       WHERE ssa.tenant_id = ? AND ssa.status = 'active'
         AND (s.is_lifetime = 1 OR (s.start_date <= ? AND (s.end_date IS NULL OR s.end_date >= ?)))`,
      [tenantId, `${month}-01`, `${month}-01`]
    );
    const scholarshipsByStudent = new Map();
    for (const scholarship of scholarshipRows) {
      const list = scholarshipsByStudent.get(scholarship.student_id) || [];
      list.push(scholarship);
      scholarshipsByStudent.set(scholarship.student_id, list);
    }

    const transportDescription = `Transport Fee — ${month}`;
    const [busRows] = await connection.query(
      `SELECT DISTINCT student_id FROM ledger_entries
       WHERE tenant_id = ? AND description = ?`,
      [tenantId, transportDescription]
    );
    const busChargedStudents = new Set(busRows.map((row) => row.student_id));
    const invoiceValues = [];
    const ledgerValues = [];
    const completedAssignments = [];

    for (const assignment of assignmentRows) {
      // Dedup per assignment+month: one invoice per fee plan per student per month
      const assignmentKey = `${assignment.student_id}:${assignment.fee_plan_id}`;
      if (existingKeys.has(assignmentKey)) {
        skipped += 1;
        continue;
      }
      existingKeys.add(assignmentKey);
      if (!(assignment.student_id in studentBalances)) studentBalances[assignment.student_id] = 0;

      counter += 1;
      const invoiceId = uuidv4();
      const invoiceNumber = `INV-${String(10000 + counter)}`;
      const [year, monthNumber] = month.split('-').map(Number);
      const lastDay = new Date(year, monthNumber, 0).getDate();
      const dueDate = `${month}-${String(Math.min(Number(assignment.due_day) || 1, lastDay)).padStart(2, '0')}`;

      // Apply active scholarships
      const schRows = scholarshipsByStudent.get(assignment.student_id) || [];

      const grossAmount = parseFloat(assignment.amount);
      let totalDiscount = 0;
      for (const sch of schRows) {
        if (sch.type === 'percentage') {
          totalDiscount += grossAmount * (parseFloat(sch.value) / 100);
        } else {
          totalDiscount += parseFloat(sch.value);
        }
      }
      totalDiscount = Math.min(totalDiscount, grossAmount);
      const netAmount = parseFloat((grossAmount - totalDiscount).toFixed(2));

      // Check bus service eligibility before building the invoice total
      const busMonthlyFee = parseFloat(assignment.bus_monthly_fee || 0);
      const busActive = assignment.uses_bus_service &&
        busMonthlyFee > 0 &&
        assignment.bus_service_start_month <= month &&
        (!assignment.bus_service_end_month || assignment.bus_service_end_month >= month);

      // Invoice total = net tuition + bus fee (so one payment clears everything)
      const invoiceAmount = parseFloat((netAmount + (busActive ? busMonthlyFee : 0)).toFixed(2));

      invoiceValues.push([
        invoiceId, tenantId, invoiceNumber, assignment.student_id, assignment.fee_plan_id,
        assignment.student_name, assignment.consumer_number, month, invoiceAmount,
        parseFloat(assignment.late_fee || 0), 'pending', dueDate,
      ]);

      // Create ledger charge entry for this fee plan — balance carries the running total
      studentBalances[assignment.student_id] = parseFloat((studentBalances[assignment.student_id] + netAmount).toFixed(2));
      const ledgerId = uuidv4();
      ledgerValues.push([
        ledgerId, tenantId, assignment.student_id, dueDate, `${assignment.fee_plan_name} — ${month}`,
        netAmount, 0, studentBalances[assignment.student_id], invoiceNumber, invoiceNumber,
        'charge', grossAmount, totalDiscount, netAmount,
      ]);

      // Create ledger charge entry for bus fee if student has active bus service this month
      if (busActive) {
        if (!busChargedStudents.has(assignment.student_id)) {
          studentBalances[assignment.student_id] = parseFloat((studentBalances[assignment.student_id] + busMonthlyFee).toFixed(2));
          const busLedgerId = uuidv4();
          ledgerValues.push([
            busLedgerId, tenantId, assignment.student_id, dueDate, transportDescription,
            busMonthlyFee, 0, studentBalances[assignment.student_id], invoiceNumber, invoiceNumber,
            'charge', null, null, null,
          ]);
          busChargedStudents.add(assignment.student_id);
        }
      }

      created += 1;

      // Auto-complete one-time plans so they don't get charged again on the next run
      if ((assignment.frequency || '').toLowerCase() === 'one-time') {
        completedAssignments.push(assignment.assignment_id);
      }
    }

    if (invoiceValues.length > 0) {
      await connection.query(
        `INSERT INTO invoices
         (id, tenant_id, invoice_number, student_id, fee_plan_id, student_name, consumer_number, month, amount, late_fee, status, due_date)
         VALUES ?`,
        [invoiceValues]
      );
    }
    if (ledgerValues.length > 0) {
      await connection.query(
        `INSERT INTO ledger_entries
         (id, tenant_id, student_id, date, description, debit, credit, balance, bill_id, reference, entry_type, gross_tuition, scholarship_discount, net_tuition)
         VALUES ?`,
        [ledgerValues]
      );
    }
    if (completedAssignments.length > 0) {
      await connection.query(
        "UPDATE payment_plan_assignments SET status = 'completed' WHERE id IN (?)",
        [completedAssignments]
      );
    }
    await connection.commit();

    await auditLog(req, 'create', 'invoice_batch', month, `Generated ${created} invoice(s) for ${month}`);
    await createRequestNotification(req, {
      title: 'Fee generation completed',
      message: `${created} invoice(s) generated for ${month}; ${skipped} skipped because they already existed.`,
      type: 'system',
      tenantId,
    });

    res.json({ data: { month, created, skipped }, message: 'Fee generation completed' });
  } catch (err) {
    if (connection) await connection.rollback();
    next(err);
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { fetchInvoices, getInvoice, createInvoice, updateInvoiceStatus, deleteInvoice, generateInvoicesFromAssignments };
