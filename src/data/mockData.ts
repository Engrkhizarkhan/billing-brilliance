import { Biller, Student, Invoice, Transaction, Scholarship, FeePlan, Service, Applicant } from '@/types';

const FINTECH_PREFIX = '123456';

export const generateConsumerNumber = (billerCode: string, studentNum: string): string => {
  return `${FINTECH_PREFIX}${billerCode}${studentNum.padStart(14, '0')}`;
};

export const billers: Biller[] = [
  { id: '1', name: 'Beacon House School', type: 'school', billerCode: '1001', email: 'info@beaconhouse.edu', phone: '+92-300-1234567', status: 'active', createdAt: '2024-01-15' },
  { id: '2', name: 'City Grammar School', type: 'school', billerCode: '1002', email: 'admin@citygrammar.edu', phone: '+92-301-2345678', status: 'active', createdAt: '2024-02-10' },
  { id: '3', name: 'Global ETA Services', type: 'eta', billerCode: '2001', email: 'contact@globaleta.com', phone: '+92-302-3456789', status: 'active', createdAt: '2024-03-05' },
  { id: '4', name: 'Premier Academy', type: 'school', billerCode: '1003', email: 'hello@premieracademy.edu', phone: '+92-303-4567890', status: 'suspended', createdAt: '2024-01-20' },
  { id: '5', name: 'Swift Agency', type: 'private_agency', billerCode: '3001', email: 'info@swiftagency.com', phone: '+92-304-5678901', status: 'active', createdAt: '2024-04-12' },
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

export const students: Student[] = studentNames.map((name, i) => ({
  id: `s${i + 1}`,
  name,
  rollNumber: `R${String(i + 1).padStart(4, '0')}`,
  class: classes[i % classes.length],
  phone: `+92-30${i % 10}-${String(1000000 + i).slice(-7)}`,
  consumerNumber: generateConsumerNumber('1001', String(i + 1)),
  status: 'active' as const,
  billerId: i < 25 ? '1' : '2',
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
  { id: 'sch7', name: 'Staff Child Discount', type: 'percentage', value: 75, startDate: '2025-01-01', endDate: '2025-12-31', status: 'active' },
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

export const services: Service[] = [
  { id: 'srv1', name: 'Visa Processing', paymentType: 'one-time', amount: 50000, status: 'active' },
  { id: 'srv2', name: 'Document Attestation', paymentType: 'multiple', amount: 30000, status: 'active' },
  { id: 'srv3', name: 'Monthly Consultation', paymentType: 'recurring', amount: 10000, status: 'active' },
  { id: 'srv4', name: 'Immigration Filing', paymentType: 'one-time', amount: 75000, status: 'active' },
  { id: 'srv5', name: 'Legal Advisory', paymentType: 'recurring', amount: 15000, status: 'inactive' },
];

export const applicants: Applicant[] = [
  { id: 'a1', name: 'Tariq Mehmood', cnic: '35201-1234567-1', consumerNumber: generateConsumerNumber('2001', '1'), paymentStatus: 'paid', serviceId: 'srv1' },
  { id: 'a2', name: 'Nazia Bibi', cnic: '35202-2345678-2', consumerNumber: generateConsumerNumber('2001', '2'), paymentStatus: 'pending', serviceId: 'srv2' },
  { id: 'a3', name: 'Rafiq Ahmad', cnic: '35203-3456789-3', consumerNumber: generateConsumerNumber('2001', '3'), paymentStatus: 'partial', serviceId: 'srv1' },
  { id: 'a4', name: 'Saira Bano', cnic: '35204-4567890-4', consumerNumber: generateConsumerNumber('2001', '4'), paymentStatus: 'paid', serviceId: 'srv3' },
  { id: 'a5', name: 'Zulfiqar Ali', cnic: '35205-5678901-5', consumerNumber: generateConsumerNumber('2001', '5'), paymentStatus: 'pending', serviceId: 'srv2' },
  { id: 'a6', name: 'Samina Kausar', cnic: '35206-6789012-6', consumerNumber: generateConsumerNumber('2001', '6'), paymentStatus: 'paid', serviceId: 'srv4' },
  { id: 'a7', name: 'Javed Akhtar', cnic: '35207-7890123-7', consumerNumber: generateConsumerNumber('2001', '7'), paymentStatus: 'partial', serviceId: 'srv3' },
  { id: 'a8', name: 'Rubina Shaheen', cnic: '35208-8901234-8', consumerNumber: generateConsumerNumber('2001', '8'), paymentStatus: 'pending', serviceId: 'srv1' },
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
