export type UserRole = 'admin' | 'school' | 'org';
export type SchoolAccessRole = 'admin' | 'finance' | 'staff' | 'viewer';

export interface User {
  id: string;
  tenantId?: string | null;
  email: string;
  name: string;
  role: UserRole;
  status: 'active' | 'suspended' | 'banned';
  schoolRef?: string;
  mainSchoolUserId?: string;
  schoolAccessRole?: SchoolAccessRole;
  verified?: boolean;
  isProtected?: boolean;
  tenantApiKey?: string;
}

export interface Biller {
  id: string;
  name: string;
  type: 'school' | 'org' | 'private_agency';
  billerCode: string;
  email: string;
  phone: string;
  status: 'active' | 'suspended' | 'banned';
  createdAt: string;
  apiKey?: string;
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
  studentId?: string;
  feePlanId?: string;
  studentName: string;
  consumerNumber: string;
  month: string;
  amount: number;
  lateFee?: number;
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

export interface PaymentPlanAssignment {
  id: string;
  studentId: string;
  feePlanId: string;
  status: 'active' | 'pending' | 'completed';
  assignedVia: 'class' | 'individual';
  assignedDate: string;
  nextDueDate: string | null;
  studentName?: string;
  consumerNumber?: string;
  className?: string;
  sectionName?: string;
  planName?: string;
  amount?: number;
  frequency?: FeePlan['frequency'];
  planType?: 'tuition' | 'additional';
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

export interface StudentFinancialSummary {
  studentId: string;
  totalDue: number;
  overdueMonths: number;
  lastPaymentDate?: string | null;
}

export interface StudentLedgerSummary {
  id: string;
  name: string;
  class: string;
  section: string;
  rollNumber: string;
  consumerNumber: string;
  billId: string;
  status: string;
  totalDebit: number;
  totalCredit: number;
  runningBalance: number;
  entryCount: number;
}

export interface LedgerAllocation {
  monthKey: string;
  amount: number;
}

export interface FeePlan {
  id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'yearly' | 'one-time';
  dueDay: number;
  lateFee: number;
  planType: 'tuition' | 'additional';
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
  entryType?: 'charge' | 'payment' | 'adjustment' | 'late_fee';
  allocations?: LedgerAllocation[];
  grossTuition?: number;
  scholarshipDiscount?: number;
  netTuition?: number;
}

export interface OrgPosting {
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
  userEmail?: string;
  userRole?: UserRole | 'school';
  schoolAccessRole?: SchoolAccessRole;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  createdAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AppNotification {
  id: string;
  tenantId?: string | null;
  userId?: string | null;
  title: string;
  message: string;
  type: 'payment' | 'applicant' | 'alert' | 'system';
  isRead: boolean;
  createdAt: string;
}

export interface BillingPolicySetting {
  feeGenerationMode: 'auto' | 'manual' | 'hybrid';
  alertOnSchedulerFailure: boolean;
  autoApplyLateFee: boolean;
  schedulerLastRun: string;
  lastManualRunAt: string | null;
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
  pendingCount?: number;
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
  companyId: string;
  responseCode: string;
  billerName: string;
  bundleDetails: BillBundleDetail[];
}

export type OrgPaymentStatus = 'pending' | 'paid' | 'failed' | 'expired';

export interface OrgPaymentRecord {
  id: string;
  applicationId: string;
  applicantId: string;
  postingId: string;
  billId: string;
  consumerNumber?: string;
  amount: number;
  status: OrgPaymentStatus;
  dueDate: string;
  expiryDate: string;
  createdAt: string;
  paidAt?: string;
  transactionId?: string;
  description?: string;
  callbackUrl: string;
}

export interface OrgCreatePaymentRequest {
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

export interface OrgCreatePaymentResponse {
  paymentId: string;
  billId: string;
  consumerNumber?: string;
  status: OrgPaymentStatus;
  payment: OrgPaymentRecord;
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

export interface OrgPaymentStatusResponse {
  applicationId: string;
  status: OrgPaymentStatus | 'not_found';
  payment?: OrgPaymentRecord;
}

export interface OrgPaymentCallbackRequest {
  billId: string;
  status: Extract<OrgPaymentStatus, 'paid' | 'failed' | 'expired'>;
  transactionId: string;
  paidAt?: string;
}

export interface OrgPaymentCallbackResponse {
  acknowledged: boolean;
  payment?: OrgPaymentRecord;
  message: string;
}

export interface OrgPaymentNotification {
  id: string;
  applicationId: string;
  paymentId: string;
  billId: string;
  status: OrgPaymentStatus;
  sentAt: string;
}

export interface OrgHealthResponse {
  status: 'ok';
  service: 'org-payment-controller';
  timestamp: string;
}

export interface OrgRequestSecurityContext {
  apiKey?: string;
  sourceIp?: string;
  protocol?: 'https' | 'http';
  webhookSignature?: string;
  idempotencyKey?: string;
}

// ── 1LINK Bundle Management ──────────────────────────────────────────────────

export interface Bundle {
  id: string;
  pcid: string;
  billerName: string;
  bundleId: string;
  bundleName: string;
  description?: string;
  expiryDate?: string;
  amount: string;
  tag?: string;
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

export interface PcidKey {
  pcid: string;
  apiKey: string;
  billerId?: string;
  billerName?: string;
  createdAt?: string;
  updatedAt?: string;
}
