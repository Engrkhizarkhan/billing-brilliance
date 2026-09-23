const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { auditLog } = require('../middleware/auditLog');
const { lockBillingTenant, createInvoiceCharges } = require('../services/invoiceAccountingService');
const { billingDueDate, money } = require('../services/billingRules');
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
    const { studentId, month, amount, dueDate } = req.body;
    if (!studentId || !Number.isFinite(Number(amount)) || Number(amount) <= 0) throw new AppError('Student and positive amount are required', 400, 'INVALID_AMOUNT');
    connection = await pool.getConnection();
    await connection.beginTransaction();
    await lockBillingTenant(connection, tenantId);
    const [invoice] = await createInvoiceCharges(connection, tenantId, [{ studentId, month, amount, dueDate }]);
    await connection.commit();
    await auditLog(req, 'create', 'invoice', invoice.id, `Invoice ${invoice.invoiceNumber} for ${invoice.amount}`);
    const [[row]] = await pool.query('SELECT * FROM invoices WHERE id = ? AND tenant_id = ?', [invoice.id, tenantId]);
    res.status(201).json({ data: row, message: 'Invoice created' });
  } catch (err) {
    if (connection) await connection.rollback();
    next(err);
  } finally { if (connection) connection.release(); }
};

const updateInvoiceStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['pending', 'overdue'].includes(status)) throw new AppError('Payment states require the payment or reversal workflow', 409, 'PAYMENT_POSTING_REQUIRED');
    let where = 'WHERE id = ? AND deleted_at IS NULL';
    const params = [req.params.id];
    if (req.tenantId) { where += ' AND tenant_id = ?'; params.push(req.tenantId); }
    const [[existing]] = await pool.query(`SELECT * FROM invoices ${where}`, params);
    if (!existing) throw new AppError('Invoice not found', 404);
    if (existing.status === 'paid') throw new AppError('Reverse the payment before changing a settled invoice', 409, 'PAYMENT_IMMUTABLE');
    const [updated] = await pool.query(`UPDATE invoices SET status = ? ${where} AND status != 'paid'`, [status, ...params]);
    if (!updated.affectedRows) throw new AppError('Invoice changed; refresh and retry', 409, 'INVOICE_STATE_CHANGED');
    await auditLog(req, 'update', 'invoice', existing.id, `Invoice status → ${status}`);
    res.json({ data: { ...existing, status }, message: 'Invoice updated' });
  } catch (err) { next(err); }
};

const deleteInvoice = async (req, res, next) => {
  let connection;
  try {
    let where = 'WHERE id = ? AND deleted_at IS NULL';
    const params = [req.params.id];
    if (req.tenantId) { where += ' AND tenant_id = ?'; params.push(req.tenantId); }
    const [[target]] = await pool.query(`SELECT tenant_id FROM invoices ${where}`, params);
    if (!target) throw new AppError('Invoice not found', 404);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    await lockBillingTenant(connection, target.tenant_id);
    const [[invoice]] = await connection.query(`SELECT * FROM invoices ${where} FOR UPDATE`, params);
    if (!invoice || invoice.status !== 'pending') throw new AppError('Only pending invoices can be cancelled', 409, 'INVOICE_STATE_CHANGED');
    const [[charge]] = await connection.query(`SELECT COALESCE(SUM(debit-credit),0) AS amount FROM ledger_entries
      WHERE tenant_id = ? AND student_id = ? AND entry_type = 'charge' AND (reference = ? OR bill_id = ?)`,
    [invoice.tenant_id, invoice.student_id, invoice.invoice_number, invoice.invoice_number]);
    if (money(charge.amount) !== money(invoice.amount)) throw new AppError('This legacy invoice needs ledger reconciliation before cancellation', 409, 'LEDGER_RECONCILIATION_REQUIRED');
    const [[totals]] = await connection.query('SELECT COALESCE(SUM(debit-credit),0) AS balance FROM ledger_entries WHERE tenant_id = ? AND student_id = ?', [invoice.tenant_id, invoice.student_id]);
    const balance = money(Number(totals.balance) - Number(charge.amount));
    await connection.query(`INSERT INTO ledger_entries
      (id, tenant_id, student_id, date, description, debit, credit, balance, bill_id, reference, entry_type)
      VALUES (?, ?, ?, UTC_DATE(), ?, 0, ?, ?, ?, ?, 'adjustment')`,
    [uuidv4(), invoice.tenant_id, invoice.student_id, `Invoice cancellation — ${invoice.invoice_number}`, charge.amount, balance, invoice.invoice_number, `CANCEL-${invoice.id}`]);
    await connection.query('UPDATE students SET balance = ? WHERE id = ? AND tenant_id = ?', [balance, invoice.student_id, invoice.tenant_id]);
    await connection.query('UPDATE invoices SET deleted_at = UTC_TIMESTAMP() WHERE id = ? AND tenant_id = ?', [invoice.id, invoice.tenant_id]);
    await connection.query(`INSERT INTO audit_logs (id, tenant_id, user_id, user_name, action, entity, entity_id, details)
      VALUES (?, ?, ?, ?, 'delete', 'invoice', ?, ?)`,
    [uuidv4(), invoice.tenant_id, req.user?.id || null, req.user?.name || 'Administrator', invoice.id, `Cancelled ${invoice.invoice_number}; ledger credit ${charge.amount}`]);
    await connection.commit();
    res.json({ data: true, message: `Invoice ${invoice.invoice_number} cancelled` });
  } catch (err) {
    if (connection) await connection.rollback();
    next(err);
  } finally { if (connection) connection.release(); }
};

const generateInvoicesFromAssignments = async (req, res, next) => {
  let connection;
  try {
    const tenantId = req.tenantId || req.body.tenantId;
    if (!tenantId) throw new AppError('Tenant ID is required', 400);
    const month = String(req.body.month || new Date().toISOString().slice(0, 7));
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new AppError('Invalid billing month', 400, 'INVALID_BILLING_MONTH');
    connection = await pool.getConnection();
    await connection.beginTransaction();
    await lockBillingTenant(connection, tenantId);
    const [assignments] = await connection.query(`SELECT ppa.id AS assignment_id, ppa.student_id, ppa.assigned_date, ppa.next_due_date,
      fp.id AS fee_plan_id, fp.name AS fee_plan_name, fp.amount, fp.due_day, fp.late_fee, fp.frequency, fp.plan_type,
      s.uses_bus_service, s.bus_service_start_month, s.bus_service_end_month, s.bus_monthly_fee
      FROM payment_plan_assignments ppa
      JOIN students s ON s.id = ppa.student_id AND s.tenant_id = ppa.tenant_id AND s.deleted_at IS NULL AND s.status = 'active'
      JOIN fee_plans fp ON fp.id = ppa.fee_plan_id AND fp.tenant_id = ppa.tenant_id AND fp.deleted_at IS NULL
      WHERE ppa.tenant_id = ? AND ppa.status = 'active'`, [tenantId]);
    const [existing] = await connection.query('SELECT student_id, fee_plan_id FROM invoices WHERE tenant_id = ? AND month = ? AND deleted_at IS NULL', [tenantId, month]);
    const keys = new Set(existing.map(row => `${row.student_id}:${row.fee_plan_id}`));
    const [scholarships] = await connection.query(`SELECT ssa.student_id, s.type, s.value FROM student_scholarship_assignments ssa
      JOIN scholarships s ON s.id = ssa.scholarship_id AND s.tenant_id = ssa.tenant_id AND s.deleted_at IS NULL AND s.status = 'active'
      WHERE ssa.tenant_id = ? AND ssa.status = 'active' AND ssa.effective_from <= ?
      AND (s.is_lifetime = 1 OR (s.start_date <= ? AND (s.end_date IS NULL OR s.end_date >= ?)))`, [tenantId, `${month}-01`, `${month}-01`, `${month}-01`]);
    const description = `Transport Fee — ${month}`;
    const [busRows] = await connection.query(`SELECT DISTINCT l.student_id FROM ledger_entries l JOIN invoices i
      ON i.tenant_id = l.tenant_id AND i.invoice_number = l.bill_id AND i.deleted_at IS NULL
      WHERE l.tenant_id = ? AND l.description = ?`, [tenantId, description]);
    const busCharged = new Set(busRows.map(row => row.student_id));
    const charges = [], completed = [];
    let skipped = 0;
    for (const assignment of assignments) {
      const key = `${assignment.student_id}:${assignment.fee_plan_id}`;
      const dueDate = billingDueDate(assignment, month);
      if (!dueDate || keys.has(key)) { skipped++; continue; }
      keys.add(key);
      const gross = money(assignment.amount);
      const discount = assignment.plan_type === 'additional' ? 0 : Math.min(gross, money(scholarships
        .filter(s => s.student_id === assignment.student_id)
        .reduce((sum, s) => sum + (s.type === 'percentage' ? gross * Number(s.value) / 100 : Number(s.value)), 0)));
      const net = money(gross - discount);
      charges.push({ studentId: assignment.student_id, feePlanId: assignment.fee_plan_id, month, dueDate, lateFee: assignment.late_fee,
        components: [{ description: `${assignment.fee_plan_name} — ${month}`, amount: net,
          ...(assignment.plan_type !== 'additional' ? { grossTuition: gross, scholarshipDiscount: discount, netTuition: net } : {}) }] });
      if (assignment.frequency === 'one-time') completed.push(assignment.assignment_id);
    }
    const [transportStudents] = await connection.query(`SELECT id AS student_id, uses_bus_service,
      bus_service_start_month, bus_service_end_month, bus_monthly_fee FROM students
      WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'active' AND uses_bus_service = 1`, [tenantId]);
    for (const student of transportStudents) {
      if (busCharged.has(student.student_id) || !student.uses_bus_service || Number(student.bus_monthly_fee) <= 0
        || !student.bus_service_start_month || student.bus_service_start_month > month
        || (student.bus_service_end_month && student.bus_service_end_month < month)) continue;
      const component = { description, amount: money(student.bus_monthly_fee) };
      const invoice = charges.find(charge => charge.studentId === student.student_id);
      if (invoice) invoice.components.push(component);
      else charges.push({ studentId: student.student_id, month, dueDate: `${month}-01`, components: [component] });
      busCharged.add(student.student_id);
    }
    const created = (await createInvoiceCharges(connection, tenantId, charges)).length;
    if (completed.length) await connection.query("UPDATE payment_plan_assignments SET status = 'completed' WHERE tenant_id = ? AND id IN (?)", [tenantId, completed]);
    await connection.commit();
    await auditLog(req, 'create', 'invoice_batch', month, `Generated ${created} invoice(s) for ${month}`);
    await createRequestNotification(req, { title: 'Fee generation completed', message: `${created} invoice(s) generated; ${skipped} ineligible or existing assignments skipped.`, type: 'system', tenantId });
    res.json({ data: { month, created, skipped }, message: 'Fee generation completed' });
  } catch (err) {
    if (connection) await connection.rollback();
    next(err);
  } finally { if (connection) connection.release(); }
};
module.exports = { fetchInvoices, getInvoice, createInvoice, updateInvoiceStatus, deleteInvoice, generateInvoicesFromAssignments };
