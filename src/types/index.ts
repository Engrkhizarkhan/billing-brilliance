export type UserRole = 'admin' | 'school' | 'eta';
export type SchoolAccessRole = 'admin' | 'finance' | 'staff' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: 'active' | 'suspended' | 'banned';
  schoolRef?: string;
  mainSchoolUserId?: string;
  schoolAccessRole?: SchoolAccessRole;
  verified?: boolean;
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

export interface OneLinkInquiryReservedFields {
  cnic?: string;
  accountId?: string;
  bundleId?: string;
  supportingInfo1?: string;
  supportingInfo2?: string;
}

export interface BillBundleDetail {
  bundleId: string;
  bundleName: string;
  description?: string;
  expiryDate?: string;
  amount?: string;
  tag?: string;
}

export type PaymentChannel = 'jazzcash' | 'easypaisa' | 'bank_app' | 'atm' | 'counter' | 'cash_offline';

export interface BillInquiryRequest {
  consumerNumber: string;
  studentRef?: string;
  voucherNumber?: string;
  billerCode?: string;
  username?: string;
  password?: string;
  bankMnemonic?: string;
  reserved?: string;
  reservedFields?: OneLinkInquiryReservedFields;
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
  companyId?: string;
  responseCode?: string;
  bundleDetails?: BillBundleDetail[];
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

export type EtaPaymentStatus = 'pending' | 'paid' | 'failed' | 'expired';

export interface EtaPaymentRecord {
  id: string;
  applicationId: string;
  applicantId: string;
  postingId: string;
  billId: string;
  amount: number;
  status: EtaPaymentStatus;
  dueDate: string;
  expiryDate: string;
  createdAt: string;
  paidAt?: string;
  transactionId?: string;
  description?: string;
  callbackUrl: string;
}

export interface EtaCreatePaymentRequest {
  applicantId: string;
  applicationId: string;
  postingId: string;
  amount: number;
  dueDate: string;
  description?: string;
  // API contract aliases for integration payload compatibility
  applicant_id?: string;
  application_id?: string;
  posting_id?: string;
  due_date?: string;
  customerName?: string;
  customer_name?: string;
}

export interface EtaCreatePaymentResponse {
  paymentId: string;
  billId: string;
  status: EtaPaymentStatus;
  payment: EtaPaymentRecord;
  oneBillRequest: OneBillCreateBillRequest;
}

export interface OneBillCreateBillRequest {
  billId: string;
  amount: number;
  dueDate: string;
  customerName: string;
  callbackUrl: string;
  description: string;
  // API contract aliases for serialized payload compatibility
  bill_id?: string;
  due_date?: string;
  customer_name?: string;
  callback_url?: string;
}

export interface EtaPaymentStatusResponse {
  applicationId: string;
  status: EtaPaymentStatus | 'not_found';
  payment?: EtaPaymentRecord;
}

export interface EtaPaymentCallbackRequest {
  billId: string;
  status: Extract<EtaPaymentStatus, 'paid' | 'failed' | 'expired'>;
  transactionId: string;
  paidAt?: string;
}

export interface EtaPaymentCallbackResponse {
  acknowledged: boolean;
  payment?: EtaPaymentRecord;
  message: string;
}

export interface EtaPaymentNotification {
  id: string;
  applicationId: string;
  paymentId: string;
  billId: string;
  status: EtaPaymentStatus;
  sentAt: string;
}

export interface EtaHealthResponse {
  status: 'ok';
  service: 'eta-payment-controller';
  timestamp: string;
}

export interface EtaRequestSecurityContext {
  apiKey?: string;
  sourceIp?: string;
  protocol?: 'https' | 'http';
  webhookSignature?: string;
  idempotencyKey?: string;
}
