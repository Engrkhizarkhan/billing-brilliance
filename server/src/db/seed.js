const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { createConnection } = require('./db');      // also loads .env
const logger = require('../config/logger');

const FINTECH_PREFIX = process.env.FINTECH_PREFIX || '123456';

function generateConsumerNumber(billerCode, num) {
  return `${FINTECH_PREFIX}${billerCode}${String(num).padStart(14, '0')}`;
}

async function seed() {
  // --fresh: truncate all data before seeding
  if (process.argv.includes('--fresh')) {
    logger.info('--fresh flag detected — resetting database before seeding...');
    const reset = require('./reset');
    await reset();
  }

  const connection = await createConnection();

  try {
    logger.info('Starting database seed...');

    // ---- 1. Tenants ----
    const tenants = [
      { id: uuidv4(), name: 'Beacon House School', type: 'school', biller_code: '1001', email: 'info@beaconhouse.edu', phone: '0300-1234567' },
      { id: uuidv4(), name: 'City Grammar School', type: 'school', biller_code: '1002', email: 'admin@citygrammar.edu', phone: '0301-2345678' },
      { id: uuidv4(), name: 'KPK Organization', type: 'org', biller_code: '2001', email: 'contact@kpkorg.pk', phone: '0302-3456789' },
      { id: uuidv4(), name: 'Premier Academy', type: 'school', biller_code: '1003', email: 'hello@premieracademy.edu', phone: '0303-4567890' },
      { id: uuidv4(), name: 'Peshawar University', type: 'school', biller_code: '1004', email: 'info@uop.edu.pk', phone: '0304-5678901' },
    ];

    for (const t of tenants) {
      await connection.query(
        `INSERT INTO tenants (id, name, type, biller_code, email, phone, status) VALUES (?, ?, ?, ?, ?, ?, 'active')
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [t.id, t.name, t.type, t.biller_code, t.email, t.phone]
      );
    }
    logger.info(`Seeded ${tenants.length} tenants`);

    // ---- 2. Roles ----
    const roles = [
      { id: uuidv4(), name: 'platform_admin', description: 'Platform administrator with full access', is_system: 1 },
      { id: uuidv4(), name: 'school_admin', description: 'School administrator', is_system: 1 },
      { id: uuidv4(), name: 'school_finance', description: 'School finance officer', is_system: 1 },
      { id: uuidv4(), name: 'school_staff', description: 'School staff member', is_system: 1 },
      { id: uuidv4(), name: 'school_viewer', description: 'School read-only viewer', is_system: 1 },
      { id: uuidv4(), name: 'org_admin', description: 'Organization administrator', is_system: 1 },
    ];

    for (const r of roles) {
      await connection.query(
        `INSERT INTO roles (id, name, description, is_system) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [r.id, r.name, r.description, r.is_system]
      );
    }
    logger.info(`Seeded ${roles.length} roles`);

    // ---- 3. Permissions ----
    const resources = ['tenants', 'users', 'students', 'invoices', 'payments', 'transactions', 'ledger', 'applicants', 'postings', 'services', 'reports', 'settings', 'audit_logs', 'scholarships', 'fee_plans', 'notifications'];
    const actions = ['create', 'read', 'update', 'delete'];
    const permissions = [];
    for (const resource of resources) {
      for (const action of actions) {
        permissions.push({
          id: uuidv4(),
          name: `${resource}:${action}`,
          resource,
          action,
          description: `${action} ${resource}`,
        });
      }
    }

    for (const p of permissions) {
      await connection.query(
        `INSERT INTO permissions (id, name, resource, action, description) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [p.id, p.name, p.resource, p.action, p.description]
      );
    }
    logger.info(`Seeded ${permissions.length} permissions`);

    // ---- 4. Users ----
    const adminPassword = process.env.ADMIN_PASSWORD || '123456';
    if (adminPassword === '123456' || adminPassword === 'admin' || adminPassword === 'password') {
      logger.warn('WARNING: ADMIN_PASSWORD is set to an insecure default ("' + adminPassword + '"). Change it before deploying to production.');
    }
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const beaconHouse = tenants[0];
    const orgTenant = tenants[2];

    const users = [
      {
        id: uuidv4(),
        tenant_id: null,
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        school_access_role: null,
        school_ref: null,
        main_school_user_id: null,
        verified: 1,
      },
      {
        id: uuidv4(),
        tenant_id: beaconHouse.id,
        email: 'school@example.com',
        name: 'School Admin',
        role: 'school',
        school_access_role: 'admin',
        school_ref: `SCH-${beaconHouse.biller_code}`,
        main_school_user_id: null, // self
        verified: 1,
      },
      {
        id: uuidv4(),
        tenant_id: orgTenant.id,
        email: 'org@example.com',
        name: 'Org Manager',
        role: 'org',
        school_access_role: null,
        school_ref: null,
        main_school_user_id: null,
        verified: 1,
      },
    ];

    // school admin's main_school_user_id = self
    users[1].main_school_user_id = users[1].id;

    // Finance sub-user
    const financeUser = {
      id: uuidv4(),
      tenant_id: beaconHouse.id,
      email: 'finance@school.com',
      name: 'School Finance',
      role: 'school',
      school_access_role: 'finance',
      school_ref: `SCH-${beaconHouse.biller_code}`,
      main_school_user_id: users[1].id,
      verified: 1,
    };
    users.push(financeUser);

    const bannedUser = {
      id: uuidv4(),
      tenant_id: orgTenant.id,
      email: 'jane@agency.com',
      name: 'Jane Smith',
      role: 'org',
      school_access_role: null,
      school_ref: null,
      main_school_user_id: null,
      verified: 1,
    };
    users.push(bannedUser);

    for (const u of users) {
      const status = u.email === 'jane@agency.com' ? 'banned' : 'active';
      await connection.query(
        `INSERT INTO users (id, tenant_id, email, password_hash, name, role, school_access_role, school_ref, main_school_user_id, status, verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [u.id, u.tenant_id, u.email, passwordHash, u.name, u.role, u.school_access_role, u.school_ref, u.main_school_user_id, status, u.verified]
      );
    }
    logger.info(`Seeded ${users.length} users`);

    // ---- 5. Students (50 students for Beacon House + City Grammar) ----
    const studentNames = [
      'Ahmed Khan', 'Sara Ali', 'Hassan Raza', 'Fatima Noor', 'Bilal Ahmed',
      'Aisha Malik', 'Usman Shah', 'Zara Iqbal', 'Kamran Yousuf', 'Hina Parvez',
      'Rizwan Ahmed', 'Sana Tariq', 'Imran Hussain', 'Nadia Butt', 'Farhan Siddiqui',
      'Mehreen Aslam', 'Adnan Chaudhry', 'Rabia Khan', 'Shahid Mehmood', 'Amna Riaz',
      'Junaid Akbar', 'Mariam Fatima', 'Asad Ullah', 'Noor Jahan', 'Waqas Ahmed',
      'Lubna Rashid', 'Tariq Aziz', 'Samina Khatoon', 'Faisal Nawaz', 'Bushra Amin',
      'Sajid Iqbal', 'Tahira Begum', 'Naveed Asghar', 'Sadia Parveen', 'Khalid Mahmood',
      'Asma Zaheer', 'Rashid Ali', 'Uzma Saleem', 'Zahid Hussain', 'Parveen Akhtar',
      'Mansoor Ahmad', 'Rukhsana Bibi', 'Akram Khan', 'Nasreen Akhtar', 'Qaiser Abbas',
      'Shaista Jabeen', 'Irfan Haider', 'Fouzia Batool', 'Arshad Mehmood', 'Kiran Shahzadi',
    ];
    const fatherNames = [
      'Muhammad Khan', 'Ali Ahmed', 'Raza Shah', 'Noor Muhammad', 'Ahmed Bilal',
      'Malik Riaz', 'Shah Nawaz', 'Iqbal Hussain', 'Yousuf Khan', 'Parvez Akhtar',
      'Ahmed Siddiqui', 'Tariq Butt', 'Hussain Ali', 'Butt Sahib', 'Siddiqui Sahib',
      'Aslam Khan', 'Chaudhry Sahib', 'Khan Muhammad', 'Mehmood Ali', 'Riaz Ahmad',
    ];
    const classes = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
    const sections = ['A', 'B', 'C', 'D', 'E'];
    const kpkDistricts = ['Peshawar', 'Mardan', 'Swabi', 'Nowshera', 'Charsadda', 'Abbottabad', 'Mansehra', 'Haripur'];
    const balances = [0, 5000, 11500, 6700, 15000, 0, 8200, 0, 3500, 20000];
    const busFees = [1200, 1500, 1800, 1400, 1600];
    const busStartMonths = ['2025-01', '2025-02', '2025-03'];

    for (let i = 0; i < studentNames.length; i++) {
      const tenantId = i < 25 ? beaconHouse.id : tenants[1].id;
      const billerCode = i < 25 ? '1001' : '1002';
      const consumerNumber = generateConsumerNumber(billerCode, i + 1);
      const billId = `SCH-GHS-${String(i + 1).padStart(5, '0')}`;
      const usesBus = i % 3 !== 0;

      await connection.query(
        `INSERT INTO students (id, tenant_id, name, father_name, roll_number, class, section, phone, cnic, consumer_number, bill_id, status, balance, admission_date, gender, date_of_birth, address, uses_bus_service, bus_service_start_month, bus_service_end_month, bus_monthly_fee)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [
          uuidv4(), tenantId, studentNames[i], fatherNames[i % fatherNames.length],
          `R${String(i + 1).padStart(4, '0')}`, classes[i % classes.length], sections[Math.floor(i / classes.length) % sections.length],
          `03${i % 10}${i}-${String(1000000 + i).slice(-7)}`,
          `${35201 + i}-${String(1234567 + i)}-${i % 10}`,
          consumerNumber, billId,
          i % 12 === 0 ? 'inactive' : 'active',
          balances[i % 10],
          `202${i % 3 + 2}-0${(i % 9) + 1}-15`,
          i % 3 === 1 ? 'female' : 'male',
          `20${10 + (i % 8)}-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, '0')}`,
          `House ${i + 1}, Street ${(i % 20) + 1}, ${kpkDistricts[i % kpkDistricts.length]}`,
          usesBus ? 1 : 0,
          usesBus ? busStartMonths[i % busStartMonths.length] : null,
          null,
          usesBus ? busFees[i % busFees.length] : 0,
        ]
      );
    }
    logger.info(`Seeded ${studentNames.length} students`);

    // ---- 6. Fee Plans ----
    const feePlans = [
      { name: 'Standard Monthly', amount: 15000, frequency: 'monthly', due_day: 10, late_fee: 500 },
      { name: 'Premium Monthly', amount: 25000, frequency: 'monthly', due_day: 5, late_fee: 1000 },
      { name: 'Quarterly Plan', amount: 42000, frequency: 'quarterly', due_day: 1, late_fee: 1500 },
      { name: 'Annual Plan', amount: 150000, frequency: 'yearly', due_day: 15, late_fee: 5000 },
    ];

    for (const fp of feePlans) {
      await connection.query(
        `INSERT INTO fee_plans (id, tenant_id, name, amount, frequency, due_day, late_fee)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [uuidv4(), beaconHouse.id, fp.name, fp.amount, fp.frequency, fp.due_day, fp.late_fee]
      );
    }
    logger.info(`Seeded ${feePlans.length} fee plans`);

    // ---- 7. Fee Heads ----
    const feeHeads = [
      { name: 'Tuition Fee', amount: 5000, frequency: 'monthly', due_day: 10 },
      { name: 'Transport Fee', amount: 1500, frequency: 'monthly', due_day: 10 },
      { name: 'Exam Fee', amount: 3000, frequency: 'quarterly', due_day: 1 },
      { name: 'Library Fee', amount: 500, frequency: 'monthly', due_day: 10 },
      { name: 'Lab Fee', amount: 2000, frequency: 'monthly', due_day: 10 },
      { name: 'Sports Fee', amount: 1000, frequency: 'quarterly', due_day: 1 },
      { name: 'Admission Fee', amount: 15000, frequency: 'one-time', due_day: 15 },
    ];

    for (const fh of feeHeads) {
      await connection.query(
        `INSERT INTO fee_heads (id, tenant_id, name, amount, frequency, applicable_classes, due_day)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [uuidv4(), beaconHouse.id, fh.name, fh.amount, fh.frequency, JSON.stringify(classes), fh.due_day]
      );
    }
    logger.info(`Seeded ${feeHeads.length} fee heads`);

    // ---- 8. Scholarships ----
    const scholarshipsData = [
      { name: 'Merit Scholarship', type: 'percentage', value: 25, start_date: '2025-01-01', end_date: '2025-12-31', status: 'active' },
      { name: 'Need-Based Grant', type: 'fixed', value: 5000, start_date: '2025-01-01', end_date: '2025-06-30', status: 'active' },
      { name: 'Sports Scholarship', type: 'percentage', value: 50, start_date: '2025-03-01', end_date: '2025-12-31', status: 'active' },
      { name: 'Academic Excellence', type: 'percentage', value: 100, start_date: '2024-01-01', end_date: '2024-12-31', status: 'expired' },
      { name: 'Sibling Discount', type: 'fixed', value: 3000, start_date: '2025-01-01', end_date: '2025-12-31', status: 'active' },
      { name: 'Staff Child Discount (Lifetime)', type: 'percentage', value: 75, start_date: '2025-01-01', end_date: null, is_lifetime: 1, status: 'active' },
    ];

    for (const s of scholarshipsData) {
      await connection.query(
        `INSERT INTO scholarships (id, tenant_id, name, type, value, start_date, end_date, is_lifetime, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [uuidv4(), beaconHouse.id, s.name, s.type, s.value, s.start_date, s.end_date, s.is_lifetime || 0, s.status]
      );
    }
    logger.info(`Seeded ${scholarshipsData.length} scholarships`);

    // ---- 9. Org Postings ----
    const postings = [
      { title: 'MDCAT 2025', type: 'entry_test', department: 'Medical', total_seats: 5000, application_fee: 3500, start_date: '2025-01-01', end_date: '2025-06-30', test_date: '2025-09-15', status: 'active', applications_received: 3247 },
      { title: 'ECAT Engineering 2025', type: 'entry_test', department: 'Engineering', total_seats: 3000, application_fee: 3500, start_date: '2025-02-01', end_date: '2025-07-31', test_date: '2025-10-01', status: 'active', applications_received: 1892 },
      { title: 'Lecturer Physics KPK', type: 'job_vacancy', department: 'Education Dept KPK', total_seats: 150, application_fee: 2500, start_date: '2025-01-15', end_date: '2025-03-15', test_date: '2025-04-20', status: 'closed', applications_received: 4521 },
      { title: 'SST Math KPK', type: 'job_vacancy', department: 'Education', total_seats: 300, application_fee: 2000, start_date: '2025-04-01', end_date: '2025-06-30', test_date: '2025-08-01', status: 'draft', applications_received: 0 },
    ];

    for (const p of postings) {
      await connection.query(
        `INSERT INTO org_postings (id, tenant_id, title, type, department, total_seats, application_fee, start_date, end_date, test_date, status, applications_received)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE title = VALUES(title)`,
        [uuidv4(), orgTenant.id, p.title, p.type, p.department, p.total_seats, p.application_fee, p.start_date, p.end_date, p.test_date, p.status, p.applications_received]
      );
    }
    logger.info(`Seeded ${postings.length} Org postings`);

    // ---- 10. Services ----
    const servicesData = [
      { name: 'MDCAT Test Fee', payment_type: 'one-time', amount: 3500 },
      { name: 'ECAT Test Fee', payment_type: 'one-time', amount: 3500 },
      { name: 'Government Job Test Fee', payment_type: 'one-time', amount: 2500 },
      { name: 'Result Card Re-issue', payment_type: 'one-time', amount: 500 },
      { name: 'Duplicate Admit Card', payment_type: 'one-time', amount: 300 },
    ];

    for (const s of servicesData) {
      await connection.query(
        `INSERT INTO services (id, tenant_id, name, payment_type, amount, status)
         VALUES (?, ?, ?, ?, ?, 'active')
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [uuidv4(), orgTenant.id, s.name, s.payment_type, s.amount]
      );
    }
    logger.info(`Seeded ${servicesData.length} services`);

    // ---- 11. Applicants ----
    const applicantNames = [
      'Ali Hassan', 'Sadia Khan', 'Farooq Ahmed', 'Ayesha Bibi', 'Hamid Ullah',
      'Nazia Parveen', 'Fawad Khan', 'Huma Rashid', 'Waqar Ali', 'Saira Naz',
      'Zubair Ahmad', 'Naseem Bibi', 'Qasim Shah', 'Rahat Khan', 'Mehmood Gul',
    ];
    const qualifications = ['FSc Pre-Medical', 'FSc Pre-Engineering', 'BA', 'BSc', 'MA', 'MSc'];
    const appStatuses = ['submitted', 'fee_pending', 'fee_paid', 'roll_assigned', 'test_scheduled', 'appeared', 'result_pending', 'selected', 'rejected'];

    for (let i = 0; i < applicantNames.length; i++) {
      const consumerNumber = generateConsumerNumber('2001', String(i + 1));
      const billId = `ORG-MDCAT25-${String(i + 1).padStart(5, '0')}`;

      await connection.query(
        `INSERT INTO applicants (id, tenant_id, name, father_name, cnic, phone, email, district, gender, date_of_birth, qualification, consumer_number, bill_id, payment_status, application_status, service_id, roll_number, test_center, marks, applied_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [
          uuidv4(), orgTenant.id, applicantNames[i],
          fatherNames[i % fatherNames.length],
          `${35301 + i}-${String(7654321 + i)}-${i % 10}`,
          `03${i % 10}0-${String(5000000 + i)}`,
          `${applicantNames[i].toLowerCase().replace(/\s/g, '.')}@email.com`,
          kpkDistricts[i % kpkDistricts.length],
          i % 3 === 1 ? 'female' : 'male',
          `19${95 + (i % 5)}-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, '0')}`,
          qualifications[i % qualifications.length],
          consumerNumber, billId,
          (['paid', 'pending', 'partial'])[i % 3],
          appStatuses[i % appStatuses.length],
          null,
          i % 3 === 0 ? `MDCAT-${String(300000 + i).padStart(6, '0')}` : null,
          i % 4 === 0 ? 'Peshawar Test Center' : null,
          i % 5 === 0 ? 75 + (i * 2) : null,
          `2025-0${(i % 3) + 1}-${String((i % 28) + 1).padStart(2, '0')}`,
        ]
      );
    }
    logger.info(`Seeded ${applicantNames.length} applicants (Org)`);

    // ---- 12. Invoices ----
    const invoiceMonths = ['Jan 2025', 'Feb 2025', 'Mar 2025'];
    const invoiceAmounts = [15000, 18000, 20000, 25000, 12000];
    const invoiceStatuses = ['pending', 'paid', 'overdue'];

    // We need student consumer numbers for linking
    const [studentRows] = await connection.query(
      'SELECT id, name, consumer_number, tenant_id FROM students ORDER BY created_at LIMIT 50'
    );

    for (let i = 0; i < 30; i++) {
      const student = studentRows[i % studentRows.length];
      await connection.query(
        `INSERT INTO invoices (id, tenant_id, invoice_number, student_id, student_name, consumer_number, month, amount, status, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE student_name = VALUES(student_name)`,
        [
          uuidv4(), student.tenant_id,
          `INV-${String(10001 + i)}`,
          student.id, student.name, student.consumer_number,
          invoiceMonths[i % 3],
          invoiceAmounts[i % 5],
          invoiceStatuses[i % 3],
          `2025-0${(i % 3) + 1}-10`,
        ]
      );
    }
    logger.info('Seeded 30 invoices');

    // ---- 13. Transactions ----
    const txnStatuses = ['completed', 'pending', 'failed'];
    for (let i = 0; i < 20; i++) {
      const student = studentRows[i % studentRows.length];
      const tenant = tenants[i % tenants.length];
      await connection.query(
        `INSERT INTO transactions (id, tenant_id, transaction_id, consumer_number, amount, status, date, biller_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
        [
          uuidv4(), student.tenant_id,
          `TXN-${String(100001 + i)}`,
          student.consumer_number,
          invoiceAmounts[i % 5],
          txnStatuses[i % 3],
          `2025-03-${String(Math.max(1, 28 - i)).padStart(2, '0')}`,
          tenant.name,
        ]
      );
    }
    logger.info('Seeded 20 transactions');

    // ---- 14. Audit Logs ----
    const auditActions = ['login', 'create', 'update', 'payment', 'delete'];
    const auditEntities = ['user', 'student', 'invoice', 'transaction', 'biller'];
    for (let i = 0; i < 10; i++) {
      await connection.query(
        `INSERT INTO audit_logs (id, tenant_id, user_id, user_name, action, entity, entity_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(), tenants[i % tenants.length].id,
          users[i % users.length].id, users[i % users.length].name,
          auditActions[i % auditActions.length],
          auditEntities[i % auditEntities.length],
          `entity-${i + 1}`,
          `Seed audit entry ${i + 1}`,
          '127.0.0.1',
        ]
      );
    }
    logger.info('Seeded 10 audit logs');

    // ---- 15. Bill Bundles ----
    const bundlesData = [
      { code: 'BASIC_MONTHLY', name: 'Monthly Tuition', amount: 15000, frequency: 'monthly', description: 'Standard monthly tuition with 10th due date', due_day: 10, late_fee: 500 },
      { code: 'TRANSPORT_ADDON', name: 'Transport Fee', amount: 1500, frequency: 'monthly', description: 'Bus/van service add-on', due_day: 10, late_fee: 0 },
      { code: 'EXAM_FEE', name: 'Exam Fee (Quarterly)', amount: 3000, frequency: 'quarterly', description: 'Quarterly exam fee', due_day: 1, late_fee: 300 },
      { code: 'HOSTEL_MONTHLY', name: 'Hostel Fee', amount: 12000, frequency: 'monthly', description: 'Hostel accommodation monthly fee', due_day: 5, late_fee: 800 },
      { code: 'ANNUAL_PLAN', name: 'Annual Plan', amount: 150000, frequency: 'yearly', description: 'Yearly lump sum plan with bundled discount', due_day: 15, late_fee: 5000 },
    ];

    for (const b of bundlesData) {
      await connection.query(
        `INSERT INTO bill_bundles (id, tenant_id, code, name, amount, frequency, description, due_day, late_fee)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [uuidv4(), beaconHouse.id, b.code, b.name, b.amount, b.frequency, b.description, b.due_day, b.late_fee]
      );
    }
    logger.info(`Seeded ${bundlesData.length} bill bundles`);

    logger.info('Database seed completed successfully!');
  } catch (err) {
    logger.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
