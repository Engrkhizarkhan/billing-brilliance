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
  endDate: string;
  status: 'active' | 'expired';
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
