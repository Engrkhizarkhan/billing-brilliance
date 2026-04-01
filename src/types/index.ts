export type UserRole = 'admin' | 'school' | 'eta';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: 'active' | 'suspended' | 'banned';
}

export interface Biller {
  id: string;
  name: string;
  type: 'school' | 'eta' | 'private_agency';
  billerCode: string;
  email: string;
  phone: string;
  status: 'active' | 'suspended' | 'banned';
  createdAt: string;
}

export interface Student {
  id: string;
  name: string;
  fatherName: string;
  rollNumber: string;
  class: string;
  section: string;
  phone: string;
  cnic: string;
  consumerNumber: string;
  billId: string;
  status: 'active' | 'inactive';
  billerId: string;
  balance: number;
  admissionDate: string;
  gender: 'male' | 'female';
  dateOfBirth: string;
  address: string;
  usesBusService: boolean;
  busServiceStartMonth: string | null;
  busServiceEndMonth: string | null;
  busMonthlyFee: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  studentName: string;
  consumerNumber: string;
  month: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue';
  dueDate: string;
  billerId: string;
}

export interface Transaction {
  id: string;
  transactionId: string;
  consumerNumber: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  date: string;
  billerName: string;
}

export interface Scholarship {
  id: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  startDate: string;
  endDate: string | null;
  isLifetime?: boolean;
  status: 'active' | 'expired' | 'inactive';
}

export interface StudentScholarshipAssignment {
  id: string;
  studentId: string;
  scholarshipId: string;
  effectiveFrom: string;
  assignedAt: string;
  status: 'active' | 'inactive';
}

export type StudentRiskTier = 'current' | 'watch' | 'high-risk' | 'critical';

export interface StudentFinancialSnapshot {
  studentId: string;
  overdueMonths: number;
  totalDue: number;
  lastPaymentDate: string | null;
  scholarshipCount: number;
  riskTier: StudentRiskTier;
}

export interface LedgerAllocation {
  monthKey: string;
  amount: number;
}

export interface FeePlan {
  id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  dueDay: number;
  lateFee: number;
}

export interface Service {
  id: string;
  name: string;
  paymentType: 'one-time' | 'multiple' | 'recurring';
  amount: number;
  status: 'active' | 'inactive';
}

export interface Applicant {
  id: string;
  name: string;
  fatherName: string;
  cnic: string;
  phone: string;
  email: string;
  district: string;
  gender: 'male' | 'female';
  dateOfBirth: string;
  qualification: string;
  consumerNumber: string;
  billId: string;
  paymentStatus: 'paid' | 'pending' | 'partial';
  applicationStatus: 'submitted' | 'fee_pending' | 'fee_paid' | 'roll_assigned' | 'test_scheduled' | 'appeared' | 'result_pending' | 'selected' | 'rejected';
  serviceId: string;
  rollNumber?: string;
  testCenter?: string;
  marks?: number;
  appliedDate: string;
}

export interface FeeHead {
  id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'annual' | 'one-time';
  applicableClasses: string[];
  dueDay: number;
}

export interface LedgerEntry {
  id: string;
  studentId: string;
  date: string;
  description: string;
  feeHeadId?: string;
  debit: number;
  credit: number;
  balance: number;
  billId: string;
  reference?: string;
  entryType?: 'charge' | 'payment' | 'adjustment';
  allocations?: LedgerAllocation[];
  grossTuition?: number;
  scholarshipDiscount?: number;
  netTuition?: number;
}

export interface ETEAPosting {
  id: string;
  title: string;
  type: 'entry_test' | 'job_vacancy';
  department: string;
  totalSeats: number;
  applicationFee: number;
  startDate: string;
  endDate: string;
  testDate: string;
  status: 'draft' | 'active' | 'closed';
  applicationsReceived: number;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  timestamp: string;
  ip: string;
}

export type BillStatus = 'paid' | 'unpaid' | 'partial' | 'overdue';

export type PaymentChannel = 'jazzcash' | 'easypaisa' | 'bank_app' | 'atm' | 'counter' | 'cash_offline';

export interface BillInquiryRequest {
  consumerNumber: string;
  studentRef?: string;
  voucherNumber?: string;
  billerCode?: string;
}

export interface BillInquiryResponse {
  found: boolean;
  studentId?: string;
  studentName?: string;
  className?: string;
  section?: string;
  billId?: string;
  consumerNumber?: string;
  invoiceNumber?: string;
  amount?: number;
  dueDate?: string;
  status?: BillStatus | 'not_found';
  billerCode?: string;
  billerName?: string;
  currency?: string;
  message?: string;
}

export interface BillPaymentRequest {
  consumerNumber: string;
  amount: number;
  transactionId: string;
  paidAt: string;
  channel: PaymentChannel;
  voucherNumber?: string;
  billerCode?: string;
  notes?: string;
}

export interface BillPaymentResult {
  receiptNumber: string;
  status: BillStatus;
  amount: number;
  paidAt: string;
  consumerNumber: string;
  reference: string;
  invoiceNumber?: string;
  studentId?: string;
  billId?: string;
  billerName?: string;
  notes?: string;
}

export interface BundlePackage {
  code: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'yearly' | 'one-time';
  description: string;
  dueDay?: number;
  lateFee?: number;
}

export interface FetchBundleResponse {
  bundles: BundlePackage[];
  fetchedAt: string;
}
