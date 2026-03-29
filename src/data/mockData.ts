import { Biller, Student, Invoice, Transaction, Scholarship, FeePlan, Service, Applicant, FeeHead, LedgerEntry, ETEAPosting, AuditLog } from '@/types';

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
}));

const months = ['Jan 2025', 'Feb 2025', 'Mar 2025'];

export const invoices: Invoice[] = Array.from({ length: 30 }, (_, i) => ({
  id: `inv${i + 1}`,
  invoiceNumber: `INV-${String(10001 + i)}`,
  studentName: students[i % students.length].name,
  consumerNumber: students[i % students.length].consumerNumber,
  month: months[i % 3],
  amount: [15000, 18000, 20000, 25000, 12000][i % 5],
  status: (['pending', 'paid', 'overdue'] as const)[i % 3],
  dueDate: `2025-0${(i % 3) + 1}-10`,
  billerId: students[i % students.length].billerId,
}));

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

export const feePlans: FeePlan[] = [
  { id: 'fp1', name: 'Standard Monthly', amount: 15000, frequency: 'monthly', dueDay: 10, lateFee: 500 },
  { id: 'fp2', name: 'Premium Monthly', amount: 25000, frequency: 'monthly', dueDay: 5, lateFee: 1000 },
  { id: 'fp3', name: 'Quarterly Plan', amount: 42000, frequency: 'quarterly', dueDay: 1, lateFee: 1500 },
  { id: 'fp4', name: 'Annual Plan', amount: 150000, frequency: 'yearly', dueDay: 15, lateFee: 5000 },
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

// Generate ledger for first few students
export const generateLedger = (studentId: string): LedgerEntry[] => {
  const student = students.find(s => s.id === studentId);
  if (!student) return [];
  const entries: LedgerEntry[] = [];
  let balance = 0;
  const months = ['Jan', 'Feb', 'Mar'];
  let counter = 0;

  months.forEach((month, mi) => {
    // Tuition
    balance += 5000;
    entries.push({ id: `le-${studentId}-${counter++}`, studentId, date: `2025-0${mi + 1}-01`, description: `Tuition Fee ${month}`, feeHeadId: 'fh1', debit: 5000, credit: 0, balance, billId: student.billId });
    // Transport
    balance += 1500;
    entries.push({ id: `le-${studentId}-${counter++}`, studentId, date: `2025-0${mi + 1}-01`, description: `Transport Fee ${month}`, feeHeadId: 'fh2', debit: 1500, credit: 0, balance, billId: student.billId });

    if (mi === 0) {
      // Late fine
      balance += 200;
      entries.push({ id: `le-${studentId}-${counter++}`, studentId, date: `2025-01-15`, description: `Late Fine (${month})`, debit: 200, credit: 0, balance, billId: student.billId });
    }
    if (mi === 1) {
      // Payment
      const payment = 6700;
      balance -= payment;
      entries.push({ id: `le-${studentId}-${counter++}`, studentId, date: `2025-02-10`, description: `Payment via 1Bill`, debit: 0, credit: payment, balance, billId: student.billId, reference: `TXN-${100001 + parseInt(studentId.replace('s', ''))}` });
    }
  });
  return entries;
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
