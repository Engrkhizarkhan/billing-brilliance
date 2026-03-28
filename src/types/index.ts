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
  rollNumber: string;
  class: string;
  phone: string;
  consumerNumber: string;
  status: 'active' | 'inactive';
  billerId: string;
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
  cnic: string;
  consumerNumber: string;
  paymentStatus: 'paid' | 'pending' | 'partial';
  serviceId: string;
}
