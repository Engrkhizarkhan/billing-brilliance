import {
  AuditLog,
  Applicant,
  Biller,
  ETEAPosting,
  FeeHead,
  FeePlan,
  Invoice,
  LedgerEntry,
  Scholarship,
  Service,
  Student,
  StudentFinancialSnapshot,
  StudentRiskTier,
  StudentScholarshipAssignment,
  Transaction,
  BillStatus,
  BundlePackage,
} from '@/types';

const FINTECH_PREFIX = '123456';

export const generateConsumerNumber = (billerCode: string, studentNum: string): string => {
  return `${FINTECH_PREFIX}${billerCode}${studentNum.padStart(14, '0')}`;
};

export const billers: Biller[] = [
  { id: '1', name: 'Beacon House School', type: 'school', billerCode: '1001', email: 'info@beaconhouse.edu', phone: '0300-1234567', status: 'active', createdAt: '2024-01-15' },
  { id: '2', name: 'City Grammar School', type: 'school', billerCode: '1002', email: 'admin@citygrammar.edu', phone: '0301-2345678', status: 'active', createdAt: '2024-02-10' },
  { id: '3', name: 'ETEA KPK', type: 'eta', billerCode: '2001', email: 'contact@etea.edu.pk', phone: '0302-3456789', status: 'active', createdAt: '2024-03-05' },
  { id: '4', name: 'Premier Academy', type: 'school', billerCode: '1003', email: 'hello@premieracademy.edu', phone: '0303-4567890', status: 'suspended', createdAt: '2024-01-20' },
  { id: '5', name: 'Peshawar University', type: 'school', billerCode: '1004', email: 'info@uop.edu.pk', phone: '0304-5678901', status: 'active', createdAt: '2024-04-12' },
];

const fatherNames = [
  'Muhammad Khan', 'Ali Ahmed', 'Raza Shah', 'Noor Muhammad', 'Ahmed Bilal',
  'Malik Riaz', 'Shah Nawaz', 'Iqbal Hussain', 'Yousuf Khan', 'Parvez Akhtar',
  'Ahmed Siddiqui', 'Tariq Butt', 'Hussain Ali', 'Butt Sahib', 'Siddiqui Sahib',
  'Aslam Khan', 'Chaudhry Sahib', 'Khan Muhammad', 'Mehmood Ali', 'Riaz Ahmad',
];

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

const classes = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
const sections = ['A', 'B', 'C', 'D', 'E'];
const kpkDistricts = ['Peshawar', 'Mardan', 'Swabi', 'Nowshera', 'Charsadda', 'Abbottabad', 'Mansehra', 'Haripur', 'Swat', 'Dir Lower', 'Dir Upper', 'Kohat', 'Bannu', 'D.I. Khan'];
const busStartMonthPattern = ['2025-01', '2025-02', '2025-03'];
const busFeePattern = [1200, 1500, 1800, 1400, 1600];

export const students: Student[] = studentNames.map((name, i) => ({
  id: `s${i + 1}`,
  name,
  fatherName: fatherNames[i % fatherNames.length],
  rollNumber: `R${String(i + 1).padStart(4, '0')}`,
  class: classes[i % classes.length],
  section: sections[Math.floor(i / classes.length) % sections.length],
  phone: `03${String(i % 10)}${String(i).padStart(1, '0')}-${String(1000000 + i).slice(-7)}`,
  cnic: `${35201 + i}-${String(1234567 + i)}-${(i % 10)}`,
  consumerNumber: generateConsumerNumber('1001', String(i + 1)),
  billId: `SCH-GHS-${String(i + 1).padStart(5, '0')}`,
  status: i % 12 === 0 ? 'inactive' as const : 'active' as const,
  billerId: i < 25 ? '1' : '2',
  balance: [0, 5000, 11500, 6700, 15000, 0, 8200, 0, 3500, 20000][i % 10],
  admissionDate: `202${i % 3 + 2}-0${(i % 9) + 1}-15`,
  gender: i % 3 === 1 ? 'female' as const : 'male' as const,
  dateOfBirth: `20${10 + (i % 8)}-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, '0')}`,
  address: `House ${i + 1}, Street ${(i % 20) + 1}, ${kpkDistricts[i % kpkDistricts.length]}`,
  usesBusService: i % 3 !== 0,
  busServiceStartMonth: i % 3 !== 0 ? busStartMonthPattern[i % busStartMonthPattern.length] : null,
  busServiceEndMonth: null,
  busMonthlyFee: i % 3 !== 0 ? busFeePattern[i % busFeePattern.length] : 0,
}));

type StudentBusServiceUpdate = Pick<Student, 'usesBusService' | 'busServiceStartMonth' | 'busServiceEndMonth' | 'busMonthlyFee'>;

export const updateStudentBusService = (studentId: string, updates: StudentBusServiceUpdate): Student | null => {
  const index = students.findIndex((student) => student.id === studentId);
  if (index === -1) return null;

  students[index] = {
    ...students[index],
    ...updates,
  };

  return students[index];
};

export type RuntimeBillPayment = {
  id: string;
  studentId: string;
  consumerNumber: string;
  amount: number;
  date: string;
  reference: string;
  voucherNumber?: string;
  channel?: string;
  note?: string;
};

const runtimeBillPayments: RuntimeBillPayment[] = [];

export const recordRuntimeBillPayment = (payment: RuntimeBillPayment) => {
  runtimeBillPayments.push(payment);
  return payment;
};

export const getRuntimeBillPayments = () => runtimeBillPayments;

export const findStudentByConsumerNumber = (consumerNumber: string) =>
  students.find((student) => student.consumerNumber === consumerNumber);

const invoiceMonths = ['Jan 2025', 'Feb 2025', 'Mar 2025'];

export const invoices: Invoice[] = Array.from({ length: 30 }, (_, i) => ({
  id: `inv${i + 1}`,
  invoiceNumber: `INV-${String(10001 + i)}`,
  studentName: students[i % students.length].name,
  consumerNumber: students[i % students.length].consumerNumber,
  month: invoiceMonths[i % 3],
  amount: [15000, 18000, 20000, 25000, 12000][i % 5],
  status: (['pending', 'paid', 'overdue'] as const)[i % 3],
  dueDate: `2025-0${(i % 3) + 1}-10`,
  billerId: students[i % students.length].billerId,
}));

export const findInvoiceForConsumer = (consumerNumber: string, voucherNumber?: string): Invoice | undefined => {
  if (voucherNumber) {
    const byVoucher = invoices.find((invoice) => invoice.invoiceNumber === voucherNumber || invoice.id === voucherNumber);
    if (byVoucher) return byVoucher;
  }
  return invoices.find((invoice) => invoice.consumerNumber === consumerNumber);
};

export const markInvoiceStatus = (invoice: Invoice, status: BillStatus) => {
  if (status === 'paid') {
    invoice.status = 'paid';
    return invoice;
  }
  if (status === 'overdue') {
    invoice.status = 'overdue';
    return invoice;
  }
  invoice.status = 'pending';
  return invoice;
};

export const transactions: Transaction[] = Array.from({ length: 20 }, (_, i) => ({
  id: `t${i + 1}`,
  transactionId: `TXN-${String(100001 + i)}`,
  consumerNumber: students[i % students.length].consumerNumber,
  amount: [15000, 18000, 20000, 25000, 12000][i % 5],
  status: (['completed', 'pending', 'failed'] as const)[i % 3],
  date: `2025-03-${String(Math.max(1, 28 - i)).padStart(2, '0')}`,
  billerName: billers[i % billers.length].name,
}));

export const scholarships: Scholarship[] = [
  { id: 'sch1', name: 'Merit Scholarship', type: 'percentage', value: 25, startDate: '2025-01-01', endDate: '2025-12-31', status: 'active' },
  { id: 'sch2', name: 'Need-Based Grant', type: 'fixed', value: 5000, startDate: '2025-01-01', endDate: '2025-06-30', status: 'active' },
  { id: 'sch3', name: 'Sports Scholarship', type: 'percentage', value: 50, startDate: '2025-03-01', endDate: '2025-12-31', status: 'active' },
  { id: 'sch4', name: 'Academic Excellence', type: 'percentage', value: 100, startDate: '2024-01-01', endDate: '2024-12-31', status: 'expired' },
  { id: 'sch5', name: 'Sibling Discount', type: 'fixed', value: 3000, startDate: '2025-01-01', endDate: '2025-12-31', status: 'active' },
  { id: 'sch6', name: 'Early Bird Discount', type: 'percentage', value: 10, startDate: '2025-02-01', endDate: '2025-04-30', status: 'active' },
  { id: 'sch7', name: 'Staff Child Discount (Lifetime)', type: 'percentage', value: 75, startDate: '2025-01-01', endDate: null, isLifetime: true, status: 'active' },
  { id: 'sch8', name: 'Community Service Award', type: 'fixed', value: 8000, startDate: '2024-06-01', endDate: '2024-12-31', status: 'expired' },
  { id: 'sch9', name: 'Talent Scholarship', type: 'percentage', value: 30, startDate: '2025-01-01', endDate: '2025-12-31', status: 'active' },
  { id: 'sch10', name: 'Hardship Fund', type: 'fixed', value: 10000, startDate: '2025-01-01', endDate: '2025-06-30', status: 'active' },
];

export const studentScholarshipAssignments: StudentScholarshipAssignment[] = [
  { id: 'ssa1', studentId: 's1', scholarshipId: 'sch1', effectiveFrom: '2025-01-01', assignedAt: '2025-01-03', status: 'active' },
  { id: 'ssa2', studentId: 's2', scholarshipId: 'sch2', effectiveFrom: '2025-01-01', assignedAt: '2025-01-03', status: 'active' },
  { id: 'ssa3', studentId: 's4', scholarshipId: 'sch7', effectiveFrom: '2025-01-01', assignedAt: '2025-01-05', status: 'active' },
  { id: 'ssa4', studentId: 's8', scholarshipId: 'sch3', effectiveFrom: '2025-03-01', assignedAt: '2025-03-02', status: 'active' },
  { id: 'ssa5', studentId: 's10', scholarshipId: 'sch5', effectiveFrom: '2025-01-01', assignedAt: '2025-01-08', status: 'active' },
  { id: 'ssa6', studentId: 's13', scholarshipId: 'sch1', effectiveFrom: '2025-01-01', assignedAt: '2025-01-09', status: 'active' },
  { id: 'ssa7', studentId: 's17', scholarshipId: 'sch9', effectiveFrom: '2025-01-01', assignedAt: '2025-01-09', status: 'active' },
  { id: 'ssa8', studentId: 's20', scholarshipId: 'sch10', effectiveFrom: '2025-01-01', assignedAt: '2025-01-11', status: 'active' },
  { id: 'ssa9', studentId: 's24', scholarshipId: 'sch6', effectiveFrom: '2025-02-01', assignedAt: '2025-02-01', status: 'active' },
  { id: 'ssa10', studentId: 's31', scholarshipId: 'sch5', effectiveFrom: '2025-01-01', assignedAt: '2025-01-13', status: 'active' },
  { id: 'ssa11', studentId: 's37', scholarshipId: 'sch1', effectiveFrom: '2025-01-01', assignedAt: '2025-01-15', status: 'active' },
  { id: 'ssa12', studentId: 's42', scholarshipId: 'sch9', effectiveFrom: '2025-01-01', assignedAt: '2025-01-15', status: 'active' },
];

export const feePlans: FeePlan[] = [
  { id: 'fp1', name: 'Standard Monthly', amount: 15000, frequency: 'monthly', dueDay: 10, lateFee: 500 },
  { id: 'fp2', name: 'Premium Monthly', amount: 25000, frequency: 'monthly', dueDay: 5, lateFee: 1000 },
  { id: 'fp3', name: 'Quarterly Plan', amount: 42000, frequency: 'quarterly', dueDay: 1, lateFee: 1500 },
  { id: 'fp4', name: 'Annual Plan', amount: 150000, frequency: 'yearly', dueDay: 15, lateFee: 5000 },
];

export const billBundles: BundlePackage[] = [
  { code: 'BASIC_MONTHLY', name: 'Monthly Tuition', amount: 15000, frequency: 'monthly', description: 'Standard monthly tuition with 10th due date', dueDay: 10, lateFee: 500 },
  { code: 'TRANSPORT_ADDON', name: 'Transport Fee', amount: 1500, frequency: 'monthly', description: 'Bus/van service add-on', dueDay: 10 },
  { code: 'EXAM_FEE', name: 'Exam Fee (Quarterly)', amount: 3000, frequency: 'quarterly', description: 'Quarterly exam fee', dueDay: 1, lateFee: 300 },
  { code: 'HOSTEL_MONTHLY', name: 'Hostel Fee', amount: 12000, frequency: 'monthly', description: 'Hostel accommodation monthly fee', dueDay: 5, lateFee: 800 },
  { code: 'ANNUAL_PLAN', name: 'Annual Plan', amount: 150000, frequency: 'yearly', description: 'Yearly lump sum plan with bundled discount', dueDay: 15, lateFee: 5000 },
];

export const feeHeads: FeeHead[] = [
  { id: 'fh1', name: 'Tuition Fee', amount: 5000, frequency: 'monthly', applicableClasses: classes, dueDay: 10 },
  { id: 'fh2', name: 'Transport Fee', amount: 1500, frequency: 'monthly', applicableClasses: classes, dueDay: 10 },
  { id: 'fh3', name: 'Exam Fee', amount: 3000, frequency: 'quarterly', applicableClasses: classes.slice(5), dueDay: 1 },
  { id: 'fh4', name: 'Library Fee', amount: 500, frequency: 'monthly', applicableClasses: classes, dueDay: 10 },
  { id: 'fh5', name: 'Lab Fee', amount: 2000, frequency: 'monthly', applicableClasses: classes.slice(6), dueDay: 10 },
  { id: 'fh6', name: 'Sports Fee', amount: 1000, frequency: 'quarterly', applicableClasses: classes, dueDay: 1 },
  { id: 'fh7', name: 'Admission Fee', amount: 15000, frequency: 'one-time', applicableClasses: classes, dueDay: 15 },
];

const ledgerMonthKeys = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06'];

const paymentMultiplierPatterns: number[][] = [
  [1, 1, 1, 1, 1, 1],
  [1, 0, 2, 0, 2, 1],
  [0, 0, 0, 3, 1, 1],
  [0, 0, 0, 0, 2, 1],
  [1, 1, 0, 0, 3, 1],
];

const monthLabelFromKey = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const studentOrdinal = (studentId: string) => {
  const numeric = Number(studentId.replace(/\D/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric - 1 : 0;
};

const roundCurrency = (value: number) => Math.round(value);

const isScholarshipActiveForMonth = (scholarship: Scholarship, monthKey: string) => {
  const monthStart = `${monthKey}-01`;
  const monthEnd = `${monthKey}-31`;
  if (scholarship.status !== 'active') return false;
  if (scholarship.startDate > monthEnd) return false;
  if (scholarship.endDate && scholarship.endDate < monthStart) return false;
  return true;
};

export const getActiveScholarshipsForStudent = (studentId: string, monthKey?: string): Scholarship[] => {
  const activeAssignments = studentScholarshipAssignments.filter((assignment) => assignment.studentId === studentId && assignment.status === 'active');
  if (activeAssignments.length === 0) return [];

  const assignmentIds = new Set(activeAssignments.map((assignment) => assignment.scholarshipId));
  const linkedScholarships = scholarships.filter((scholarship) => assignmentIds.has(scholarship.id));

  if (!monthKey) {
    return linkedScholarships.filter((scholarship) => scholarship.status === 'active');
  }

  return linkedScholarships.filter((scholarship) => isScholarshipActiveForMonth(scholarship, monthKey));
};

const applyScholarshipDiscount = (baseTuition: number, activeScholarships: Scholarship[]) => {
  if (activeScholarships.length === 0) {
    return { netTuition: baseTuition, discountApplied: 0, labels: [] as string[] };
  }

  const percentageDiscount = activeScholarships
    .filter((scholarship) => scholarship.type === 'percentage')
    .reduce((sum, scholarship) => sum + scholarship.value, 0);
  const fixedDiscount = activeScholarships
    .filter((scholarship) => scholarship.type === 'fixed')
    .reduce((sum, scholarship) => sum + scholarship.value, 0);

  const percentageAmount = (Math.min(percentageDiscount, 100) / 100) * baseTuition;
  const totalDiscount = Math.min(baseTuition, percentageAmount + fixedDiscount);
  return {
    netTuition: roundCurrency(baseTuition - totalDiscount),
    discountApplied: roundCurrency(totalDiscount),
    labels: activeScholarships.map((scholarship) => scholarship.name),
  };
};

const riskTierFromOverdueMonths = (overdueMonths: number): StudentRiskTier => {
  if (overdueMonths >= 5) return 'critical';
  if (overdueMonths >= 3) return 'high-risk';
  if (overdueMonths >= 1) return 'watch';
  return 'current';
};

type GeneratedLedgerState = {
  entries: LedgerEntry[];
  monthBalances: Record<string, number>;
  lastPaymentDate: string | null;
};

const generateLedgerState = (studentId: string): GeneratedLedgerState => {
  const student = students.find((candidate) => candidate.id === studentId);
  const emptyBalances = Object.fromEntries(ledgerMonthKeys.map((monthKey) => [monthKey, 0])) as Record<string, number>;

  if (!student) {
    return { entries: [], monthBalances: emptyBalances, lastPaymentDate: null };
  }

  const entries: LedgerEntry[] = [];
  const monthBalances = { ...emptyBalances };
  const monthBuckets = ledgerMonthKeys.map((monthKey) => ({ monthKey, outstanding: 0 }));
  const paymentPattern = paymentMultiplierPatterns[studentOrdinal(studentId) % paymentMultiplierPatterns.length];
  const normalizedBusStartMonth = student.busServiceStartMonth && /^\d{4}-\d{2}$/.test(student.busServiceStartMonth)
    ? student.busServiceStartMonth
    : null;
  const normalizedBusEndMonth = student.busServiceEndMonth && /^\d{4}-\d{2}$/.test(student.busServiceEndMonth)
    ? student.busServiceEndMonth
    : null;
  const configuredBusMonthlyFee = student.busMonthlyFee > 0 ? student.busMonthlyFee : 1500;

  let runningBalance = 0;
  let sequence = 0;
  let lastPaymentDate: string | null = null;

  ledgerMonthKeys.forEach((monthKey, monthIndex) => {
    const activeScholarships = getActiveScholarshipsForStudent(studentId, monthKey);
    const { netTuition, discountApplied, labels } = applyScholarshipDiscount(5000, activeScholarships);
    const isBusBillingActive = normalizedBusStartMonth
      ? monthKey >= normalizedBusStartMonth && (!normalizedBusEndMonth || monthKey <= normalizedBusEndMonth)
      : false;
    const transportCharge = isBusBillingActive ? configuredBusMonthlyFee : 0;

    runningBalance += netTuition;
    monthBuckets[monthIndex].outstanding += netTuition;
    monthBalances[monthKey] += netTuition;
    entries.push({
      id: `le-${studentId}-${sequence++}`,
      studentId,
      date: `${monthKey}-01`,
      description: discountApplied > 0
        ? `Tuition Fee ${monthLabelFromKey(monthKey)} (after scholarship: ${labels.join(', ')})`
        : `Tuition Fee ${monthLabelFromKey(monthKey)}`,
      feeHeadId: 'fh1',
      debit: netTuition,
      credit: 0,
      balance: runningBalance,
      billId: student.billId,
      entryType: 'charge',
      grossTuition: 5000,
      scholarshipDiscount: discountApplied,
      netTuition,
    });

    if (transportCharge > 0) {
      runningBalance += transportCharge;
      monthBuckets[monthIndex].outstanding += transportCharge;
      monthBalances[monthKey] += transportCharge;
      entries.push({
        id: `le-${studentId}-${sequence++}`,
        studentId,
        date: `${monthKey}-01`,
        description: `Bus Service Fee ${monthLabelFromKey(monthKey)}`,
        feeHeadId: 'fh2',
        debit: transportCharge,
        credit: 0,
        balance: runningBalance,
        billId: student.billId,
        entryType: 'charge',
      });
    }

    if (monthIndex > 0 && monthBuckets[monthIndex - 1].outstanding > 0) {
      const lateFine = 300;
      runningBalance += lateFine;
      monthBuckets[monthIndex].outstanding += lateFine;
      monthBalances[monthKey] += lateFine;
      entries.push({
        id: `le-${studentId}-${sequence++}`,
        studentId,
        date: `${monthKey}-05`,
        description: `Late Fine ${monthLabelFromKey(monthKey)}`,
        debit: lateFine,
        credit: 0,
        balance: runningBalance,
        billId: student.billId,
        entryType: 'adjustment',
      });
    }

    const multiplier = paymentPattern[monthIndex] || 0;
    const plannedPayment = roundCurrency((netTuition + transportCharge) * multiplier);
    if (plannedPayment <= 0) return;

    let remaining = plannedPayment;
    const allocations: { monthKey: string; amount: number }[] = [];

    monthBuckets.forEach((bucket) => {
      if (remaining <= 0 || bucket.outstanding <= 0) return;
      const allocation = Math.min(bucket.outstanding, remaining);
      bucket.outstanding -= allocation;
      remaining -= allocation;
      monthBalances[bucket.monthKey] = Math.max(0, monthBalances[bucket.monthKey] - allocation);
      allocations.push({ monthKey: bucket.monthKey, amount: allocation });
    });

    const appliedAmount = plannedPayment - remaining;
    if (appliedAmount <= 0) return;

    runningBalance = Math.max(0, runningBalance - appliedAmount);
    lastPaymentDate = `${monthKey}-10`;
    const allocationSummary = allocations
      .map((allocation) => `${monthLabelFromKey(allocation.monthKey)} ${allocation.amount.toLocaleString()}`)
      .join(', ');

    entries.push({
      id: `le-${studentId}-${sequence++}`,
      studentId,
      date: `${monthKey}-10`,
      description: `Payment via 1Bill (${allocationSummary})`,
      debit: 0,
      credit: appliedAmount,
      balance: runningBalance,
      billId: student.billId,
      reference: `TXN-${100001 + studentOrdinal(studentId) + monthIndex}`,
      entryType: 'payment',
      allocations,
    });
  });

  const postedPayments = runtimeBillPayments.filter((payment) => payment.studentId === studentId).sort((a, b) => b.date.localeCompare(a.date));
  postedPayments.forEach((payment) => {
    let remaining = payment.amount;
    const allocations: { monthKey: string; amount: number }[] = [];

    ledgerMonthKeys.forEach((monthKey) => {
      if (remaining <= 0) return;
      const outstanding = monthBalances[monthKey] || 0;
      if (outstanding <= 0) return;
      const applied = Math.min(outstanding, remaining);
      monthBalances[monthKey] = Math.max(0, outstanding - applied);
      remaining -= applied;
      allocations.push({ monthKey, amount: applied });
    });

    const appliedAmount = payment.amount - remaining;
    if (appliedAmount <= 0) return;

    runningBalance = Math.max(0, runningBalance - appliedAmount);
    lastPaymentDate = payment.date;

    entries.push({
      id: `le-runtime-${payment.id}`,
      studentId,
      date: payment.date,
      description: payment.note || 'Payment via 1Bill (posted)',
      debit: 0,
      credit: appliedAmount,
      balance: runningBalance,
      billId: student.billId,
      reference: payment.reference,
      entryType: 'payment',
      allocations,
    });
  });

  return { entries, monthBalances, lastPaymentDate };
};

export const generateLedger = (studentId: string): LedgerEntry[] => {
  return generateLedgerState(studentId).entries;
};

export const getStudentFinancialSnapshot = (studentId: string): StudentFinancialSnapshot => {
  const { monthBalances, lastPaymentDate } = generateLedgerState(studentId);
  const monthlyOutstanding = Object.values(monthBalances);
  const totalDue = monthlyOutstanding.reduce((sum, amount) => sum + amount, 0);
  const overdueMonths = monthlyOutstanding.filter((amount) => amount > 0).length;

  return {
    studentId,
    overdueMonths,
    totalDue,
    lastPaymentDate,
    scholarshipCount: getActiveScholarshipsForStudent(studentId).length,
    riskTier: riskTierFromOverdueMonths(overdueMonths),
  };
};

export const getSchoolPaymentHistory = () => {
  return students
    .flatMap((student) =>
      generateLedger(student.id)
        .filter((entry) => entry.credit > 0)
        .map((entry) => ({
          id: `${student.id}-${entry.id}`,
          studentId: student.id,
          studentName: student.name,
          className: student.class,
          section: student.section,
          rollNumber: student.rollNumber,
          consumerNumber: student.consumerNumber,
          billId: student.billId,
          amount: entry.credit,
          date: entry.date,
          reference: entry.reference || '-',
          note: entry.description,
        }))
    )
    .sort((a, b) => {
      if (a.date === b.date) return b.amount - a.amount;
      return b.date.localeCompare(a.date);
    });
};

export const services: Service[] = [
  { id: 'srv1', name: 'MDCAT 2025', paymentType: 'one-time', amount: 3500, status: 'active' },
  { id: 'srv2', name: 'ECAT Engineering', paymentType: 'one-time', amount: 3500, status: 'active' },
  { id: 'srv3', name: 'Lecturer Recruitment BPS-17', paymentType: 'one-time', amount: 2500, status: 'active' },
  { id: 'srv4', name: 'SST Recruitment BPS-16', paymentType: 'one-time', amount: 2000, status: 'active' },
  { id: 'srv5', name: 'CT Recruitment BPS-15', paymentType: 'one-time', amount: 1500, status: 'inactive' },
];

export const eteaPostings: ETEAPosting[] = [
  { id: 'ep1', title: 'MDCAT 2025', type: 'entry_test', department: 'Medical', totalSeats: 5000, applicationFee: 3500, startDate: '2025-03-01', endDate: '2025-04-30', testDate: '2025-06-15', status: 'active', applicationsReceived: 3247 },
  { id: 'ep2', title: 'ECAT Engineering 2025', type: 'entry_test', department: 'Engineering', totalSeats: 3000, applicationFee: 3500, startDate: '2025-03-15', endDate: '2025-05-15', testDate: '2025-07-01', status: 'active', applicationsReceived: 1892 },
  { id: 'ep3', title: 'Lecturer Physics KPK', type: 'job_vacancy', department: 'Education Dept KPK', totalSeats: 150, applicationFee: 2500, startDate: '2025-02-01', endDate: '2025-03-31', testDate: '2025-05-10', status: 'closed', applicationsReceived: 4521 },
  { id: 'ep4', title: 'SST Math KPK', type: 'job_vacancy', department: 'Education Dept KPK', totalSeats: 300, applicationFee: 2000, startDate: '2025-04-01', endDate: '2025-05-30', testDate: '2025-07-15', status: 'draft', applicationsReceived: 0 },
];

const applicantNames = [
  'Tariq Mehmood', 'Nazia Bibi', 'Rafiq Ahmad', 'Saira Bano', 'Zulfiqar Ali',
  'Samina Kausar', 'Javed Akhtar', 'Rubina Shaheen', 'Kamran Wali', 'Ayesha Gul',
  'Hameed Khan', 'Sobia Farooq', 'Nasir Uddin', 'Farah Deeba', 'Imtiaz Ali',
];

export const applicants: Applicant[] = applicantNames.map((name, i) => ({
  id: `a${i + 1}`,
  name,
  fatherName: fatherNames[i % fatherNames.length],
  cnic: `${15201 + i}-${String(1234567 + i)}-${i % 10}`,
  phone: `03${i % 4 + 1}${i}-${String(1000000 + i * 7).slice(-7)}`,
  email: `${name.toLowerCase().replace(/\s/g, '.')}@gmail.com`,
  district: kpkDistricts[i % kpkDistricts.length],
  gender: i % 3 === 1 ? 'female' as const : 'male' as const,
  dateOfBirth: `200${i % 5}-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, '0')}`,
  qualification: ['FSc Pre-Medical', 'FSc Pre-Engineering', 'BA/BSc', 'MA/MSc', 'BS 4-Year'][i % 5],
  consumerNumber: generateConsumerNumber('2001', String(i + 1)),
  billId: `ETA-MDCAT25-${String(i + 1).padStart(5, '0')}`,
  paymentStatus: (['paid', 'pending', 'partial'] as const)[i % 3],
  applicationStatus: (['submitted', 'fee_pending', 'fee_paid', 'roll_assigned', 'test_scheduled', 'appeared', 'result_pending', 'selected', 'rejected'] as const)[i % 9],
  serviceId: ['srv1', 'srv1', 'srv2', 'srv3', 'srv1'][i % 5],
  rollNumber: i % 3 === 0 ? `MDCAT-${String(i * 100 + 1).padStart(6, '0')}` : undefined,
  testCenter: i % 3 === 0 ? `${kpkDistricts[i % kpkDistricts.length]} Test Center` : undefined,
  marks: i % 9 >= 7 ? 650 + (i * 13) % 200 : undefined,
  appliedDate: `2025-03-${String((i % 28) + 1).padStart(2, '0')}`,
}));

export const auditLogs: AuditLog[] = [
  { id: 'al1', userId: '1', userName: 'Admin User', action: 'create', entity: 'student', entityId: 's1', details: 'Created student Ahmed Khan', timestamp: '2025-03-28T10:30:00', ip: '192.168.1.100' },
  { id: 'al2', userId: '2', userName: 'School Admin', action: 'update', entity: 'fee_plan', entityId: 'fp1', details: 'Updated Standard Monthly amount from ₨12,000 to ₨15,000', timestamp: '2025-03-28T09:15:00', ip: '192.168.1.101' },
  { id: 'al3', userId: '3', userName: 'ETEA Manager', action: 'create', entity: 'posting', entityId: 'ep1', details: 'Created posting MDCAT 2025', timestamp: '2025-03-27T14:00:00', ip: '192.168.1.102' },
  { id: 'al4', userId: '1', userName: 'Admin User', action: 'payment', entity: 'transaction', entityId: 't1', details: 'Payment ₨15,000 received from Ahmed Khan via 1Bill', timestamp: '2025-03-27T11:20:00', ip: '192.168.1.100' },
  { id: 'al5', userId: '2', userName: 'School Admin', action: 'delete', entity: 'scholarship', entityId: 'sch4', details: 'Archived Academic Excellence scholarship', timestamp: '2025-03-26T16:45:00', ip: '192.168.1.101' },
];

export const revenueData = [
  { month: 'Oct', revenue: 980000 },
  { month: 'Nov', revenue: 1120000 },
  { month: 'Dec', revenue: 1050000 },
  { month: 'Jan', revenue: 1250000 },
  { month: 'Feb', revenue: 1180000 },
  { month: 'Mar', revenue: 1350000 },
];

export const paymentSuccessData = [
  { month: 'Oct', success: 85, failed: 15 },
  { month: 'Nov', success: 88, failed: 12 },
  { month: 'Dec', success: 82, failed: 18 },
  { month: 'Jan', success: 91, failed: 9 },
  { month: 'Feb', success: 87, failed: 13 },
  { month: 'Mar', success: 93, failed: 7 },
];

export const transactionVolumeData = [
  { month: 'Oct', volume: 450 },
  { month: 'Nov', volume: 520 },
  { month: 'Dec', volume: 480 },
  { month: 'Jan', volume: 610 },
  { month: 'Feb', volume: 570 },
  { month: 'Mar', volume: 680 },
];

export const feeCollectionByHead = [
  { name: 'Tuition', value: 2500000 },
  { name: 'Transport', value: 750000 },
  { name: 'Exam', value: 450000 },
  { name: 'Library', value: 250000 },
  { name: 'Lab', value: 400000 },
];

export const monthlyCollectionTarget = [
  { month: 'Oct', collected: 720000, target: 900000 },
  { month: 'Nov', collected: 810000, target: 900000 },
  { month: 'Dec', collected: 690000, target: 900000 },
  { month: 'Jan', collected: 880000, target: 900000 },
  { month: 'Feb', collected: 850000, target: 900000 },
  { month: 'Mar', collected: 920000, target: 900000 },
];
