import { get, post, put, patch, del, buildQuery } from './apiClient';
import type {
  Applicant,
  BillInquiryRequest,
  BillInquiryResponse,
  BillPaymentRequest,
  BillPaymentResult,
  Bundle,
  PcidKey,
  BundlePackage,
  FetchBundleResponse,
  OrgPosting,
  FeePlan,
  Invoice,
  LedgerEntry,
  Service,
  SchoolAccessRole,
  Student,
  User,
  Biller,
  StudentFinancialSnapshot,
  OrgPaymentRecord,
  OrgPaymentNotification,
  PaymentPlanAssignment,
  AppNotification,
  AuditLog,
} from '@/types';

export type ApiResponse<T> = { data: T; meta?: PaginationMeta; message?: string };
export type PaginationMeta = { page: number; pageSize: number; total: number };

// ---- Auth ----
export const api = {
  async login(email: string, password: string): Promise<ApiResponse<{ token: string; refreshToken: string; user: User } | null>> {
    try {
      return await post<ApiResponse<{ token: string; refreshToken: string; user: User }>>('/auth/login', { email, password }, { skipAuth: true });
    } catch (e) {
      return { data: null, message: e instanceof Error ? e.message : 'Login failed' };
    }
  },

  async getProfile(): Promise<ApiResponse<User>> {
    return get<ApiResponse<User>>('/auth/profile');
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<boolean>> {
    await put('/auth/change-password', { currentPassword, newPassword });
    return { data: true, message: 'Password changed' };
  },

  async logout(): Promise<void> {
    try {
      await post('/auth/logout', { refreshToken: localStorage.getItem('refresh_token') });
    } catch {
      // ignore
    }
  },

  // ---- Users ----
  async fetchUsers(params: { page?: number; pageSize?: number; role?: string; status?: string; search?: string } = {}): Promise<ApiResponse<User[]>> {
    const q = buildQuery({ page: params.page, pageSize: params.pageSize, role: params.role, status: params.status, search: params.search });
    return get<ApiResponse<User[]>>(`/users${q}`);
  },

  async getUser(id: string): Promise<ApiResponse<User>> {
    return get<ApiResponse<User>>(`/users/${id}`);
  },

  async createUser(payload: {
    name: string; email: string; role: User['role']; status?: string; password?: string;
    schoolRef?: string; mainSchoolUserId?: string; schoolAccessRole?: SchoolAccessRole; verified?: boolean; tenantId?: string;
  }): Promise<ApiResponse<{ user: User; defaultPassword: string }>> {
    return post<ApiResponse<{ user: User; defaultPassword: string }>>('/users', payload);
  },

  async updateUser(id: string, payload: Partial<Pick<User, 'name' | 'email' | 'verified' | 'schoolAccessRole'>>): Promise<ApiResponse<User>> {
    return put<ApiResponse<User>>(`/users/${id}`, payload);
  },

  async updateUserStatus(id: string, status: User['status']): Promise<ApiResponse<User | null>> {
    return patch<ApiResponse<User | null>>(`/users/${id}/status`, { status });
  },

  async resetPassword(id: string, newPassword?: string): Promise<ApiResponse<boolean>> {
    await put(`/users/${id}/reset-password`, { newPassword });
    return { data: true, message: 'Password reset' };
  },

  async fetchSchoolUsers(schoolRef: string): Promise<ApiResponse<User[]>> {
    return get<ApiResponse<User[]>>(`/users/school/${encodeURIComponent(schoolRef)}`);
  },

  async createSchoolSubUser(payload: {
    name: string; email: string; password: string; schoolRef: string;
    mainSchoolUserId: string; schoolAccessRole: SchoolAccessRole; verified?: boolean;
  }): Promise<ApiResponse<User>> {
    return post<ApiResponse<User>>('/users/school/sub-user', payload);
  },

  async deleteSchoolUser(id: string, _schoolRef: string): Promise<ApiResponse<boolean>> {
    return del<ApiResponse<boolean>>(`/users/school/${id}`);
  },

  // ---- Tenants / Billers (Tenants = Billers in backend) ----
  async fetchBillers(params: { page?: number; pageSize?: number; status?: string; type?: string; search?: string } = {}): Promise<ApiResponse<Biller[]>> {
    const q = buildQuery({ page: params.page, pageSize: params.pageSize, status: params.status, type: params.type, search: params.search });
    return get<ApiResponse<Biller[]>>(`/tenants${q}`);
  },

  async createBiller(payload: Pick<Biller, 'name' | 'type' | 'email' | 'phone'>): Promise<ApiResponse<Biller>> {
    return post<ApiResponse<Biller>>('/tenants', payload);
  },

  async updateBiller(id: string, payload: Partial<Pick<Biller, 'name' | 'type' | 'email' | 'phone'>>): Promise<ApiResponse<Biller | null>> {
    return put<ApiResponse<Biller | null>>(`/tenants/${id}`, payload);
  },

  async updateBillerStatus(id: string, status: Biller['status']): Promise<ApiResponse<Biller | null>> {
    return patch<ApiResponse<Biller | null>>(`/tenants/${id}/status`, { status });
  },

  async regenerateBillerApiKey(id: string): Promise<ApiResponse<Biller>> {
    return post<ApiResponse<Biller>>(`/tenants/${id}/regenerate-api-key`, {});
  },

  // ---- Students ----
  async fetchStudents(params: { page?: number; pageSize?: number; search?: string; className?: string; status?: string } = {}): Promise<ApiResponse<Student[]>> {
    const q = buildQuery({ page: params.page, pageSize: params.pageSize, search: params.search, className: params.className, status: params.status });
    return get<ApiResponse<Student[]>>(`/students${q}`);
  },

  async getStudent(id: string): Promise<ApiResponse<Student | null>> {
    return get<ApiResponse<Student | null>>(`/students/${id}`);
  },

  async createStudent(payload: Omit<Student, 'id' | 'consumerNumber' | 'billId'>): Promise<ApiResponse<Student>> {
    return post<ApiResponse<Student>>('/students', payload);
  },

  async updateStudent(id: string, payload: Partial<Student>): Promise<ApiResponse<Student | null>> {
    return put<ApiResponse<Student | null>>(`/students/${id}`, payload);
  },

  async deleteStudent(id: string): Promise<ApiResponse<boolean>> {
    return del<ApiResponse<boolean>>(`/students/${id}`);
  },

  async updateStudentBusService(studentId: string, updates: { usesBusService: boolean; busServiceStartMonth?: string | null; busServiceEndMonth?: string | null; busMonthlyFee?: number }): Promise<ApiResponse<Student | null>> {
    return patch<ApiResponse<Student | null>>(`/students/${studentId}/bus-service`, updates);
  },

  async getStudentLedger(studentId: string): Promise<ApiResponse<unknown[]>> {
    return get<ApiResponse<unknown[]>>(`/students/${studentId}/ledger`);
  },

  async getStudentSnapshot(studentId: string): Promise<ApiResponse<StudentFinancialSnapshot>> {
    return get<ApiResponse<StudentFinancialSnapshot>>(`/students/${studentId}/snapshot`);
  },

  async fetchStudentFinancialSummary(): Promise<ApiResponse<import('@/types').StudentFinancialSummary[]>> {
    return get('/students/financial-summary');
  },

  async fetchStudentLedgerSummary(params: { page?: number; pageSize?: number; search?: string; className?: string } = {}): Promise<ApiResponse<import('@/types').StudentLedgerSummary[]>> {
    const q = buildQuery({ page: params.page, pageSize: params.pageSize, search: params.search, className: params.className });
    return get(`/students/ledger-summary${q}`);
  },

  // ---- Invoices ----
  async fetchInvoices(params: { page?: number; pageSize?: number; status?: string; search?: string; billerId?: string } = {}): Promise<ApiResponse<Invoice[]>> {
    const q = buildQuery({ page: params.page, pageSize: params.pageSize, status: params.status, search: params.search, billerId: params.billerId });
    return get<ApiResponse<Invoice[]>>(`/invoices${q}`);
  },

  async getInvoice(id: string): Promise<ApiResponse<Invoice>> {
    return get<ApiResponse<Invoice>>(`/invoices/${id}`);
  },

  async createInvoice(payload: Partial<Invoice>): Promise<ApiResponse<Invoice>> {
    return post<ApiResponse<Invoice>>('/invoices', payload);
  },

  async updateInvoiceStatus(id: string, status: string): Promise<ApiResponse<Invoice>> {
    return patch<ApiResponse<Invoice>>(`/invoices/${id}/status`, { status });
  },

  async deleteInvoice(id: string): Promise<ApiResponse<boolean>> {
    return del<ApiResponse<boolean>>(`/invoices/${id}`);
  },

  // ---- Billing (1LINK) ----
  async billInquiry(request: BillInquiryRequest): Promise<ApiResponse<BillInquiryResponse>> {
    return post<ApiResponse<BillInquiryResponse>>('/billing/inquiry', request);
  },

  async postBillPayment(request: BillPaymentRequest): Promise<ApiResponse<BillPaymentResult>> {
    return post<ApiResponse<BillPaymentResult>>('/billing/payment', request);
  },

  async fetchBundles(pcid?: string): Promise<ApiResponse<FetchBundleResponse>> {
    return post<ApiResponse<FetchBundleResponse>>('/billing/fetchbundle', { PCID: pcid });
  },

  // ---- Admin Bundle Management ----
  async fetchAdminBundles(params: { pcid?: string; status?: string; search?: string; page?: number; pageSize?: number } = {}): Promise<ApiResponse<Bundle[]>> {
    const q = buildQuery(params);
    return get<ApiResponse<Bundle[]>>(`/bundles${q}`);
  },

  async createBundle(payload: Omit<Bundle, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Bundle>> {
    return post<ApiResponse<Bundle>>('/bundles', payload);
  },

  async updateBundle(id: string, payload: Partial<Omit<Bundle, 'id' | 'createdAt' | 'updatedAt'>>): Promise<ApiResponse<Bundle>> {
    return put<ApiResponse<Bundle>>(`/bundles/${id}`, payload);
  },

  async deleteBundle(id: string): Promise<ApiResponse<boolean>> {
    return del<ApiResponse<boolean>>(`/bundles/${id}`);
  },

  // ---- PCID API Key Management ----
  async fetchPcidKeys(): Promise<ApiResponse<PcidKey[]>> {
    return get<ApiResponse<PcidKey[]>>('/bundles/pcid-keys');
  },

  async regeneratePcidKey(pcid: string): Promise<ApiResponse<PcidKey>> {
    return post<ApiResponse<PcidKey>>(`/bundles/pcid-keys/${pcid}/regenerate`, {});
  },

  async linkPcidBiller(pcid: string, billerId: string | null): Promise<ApiResponse<PcidKey>> {
    return put<ApiResponse<PcidKey>>(`/bundles/pcid-keys/${pcid}/biller`, { billerId });
  },

  // ---- Transactions & Payments ----
  async fetchTransactions(params: { page?: number; pageSize?: number; status?: string; search?: string } = {}): Promise<ApiResponse<unknown[]>> {
    const q = buildQuery({ page: params.page, pageSize: params.pageSize, status: params.status, search: params.search });
    return get<ApiResponse<unknown[]>>(`/transactions${q}`);
  },

  async fetchPaymentHistory(params: { page?: number; pageSize?: number; search?: string; className?: string; channel?: string; month?: string } = {}): Promise<ApiResponse<unknown[]>> {
    const q = buildQuery(params);
    return get<ApiResponse<unknown[]>>(`/payment-history${q}`);
  },

  // ---- Applicants ----
  async fetchApplicants(params: { page?: number; pageSize?: number; status?: string; postingId?: string; search?: string } = {}): Promise<ApiResponse<Applicant[]>> {
    const q = buildQuery({ page: params.page, pageSize: params.pageSize, status: params.status, postingId: params.postingId, search: params.search });
    return get<ApiResponse<Applicant[]>>(`/applicants${q}`);
  },

  async getApplicant(id: string): Promise<ApiResponse<Applicant>> {
    return get<ApiResponse<Applicant>>(`/applicants/${id}`);
  },

  async createApplicant(payload: Partial<Applicant>): Promise<ApiResponse<Applicant>> {
    return post<ApiResponse<Applicant>>('/applicants', payload);
  },

  async assignRoll(applicantId: string, options: { rollNumber?: string; center?: string; slot?: string }): Promise<ApiResponse<Applicant | null>> {
    return patch<ApiResponse<Applicant | null>>(`/applicants/${applicantId}/assign-roll`, options);
  },

  async recordResult(applicantId: string, marks: number, status?: string): Promise<ApiResponse<Applicant | null>> {
    return patch<ApiResponse<Applicant | null>>(`/applicants/${applicantId}/result`, { marks, status });
  },

  // ---- Org Postings & Services ----
  async fetchPostings(): Promise<ApiResponse<OrgPosting[]>> {
    return get<ApiResponse<OrgPosting[]>>('/org/postings');
  },

  async createPosting(payload: Partial<OrgPosting>): Promise<ApiResponse<OrgPosting>> {
    return post<ApiResponse<OrgPosting>>('/org/postings', payload);
  },

  async updatePosting(id: string, payload: Partial<OrgPosting>): Promise<ApiResponse<OrgPosting>> {
    return put<ApiResponse<OrgPosting>>(`/org/postings/${id}`, payload);
  },

  async updatePostingStatus(id: string, status: string): Promise<ApiResponse<OrgPosting>> {
    return patch<ApiResponse<OrgPosting>>(`/org/postings/${id}/status`, { status });
  },

  async fetchServices(): Promise<ApiResponse<Service[]>> {
    return get<ApiResponse<Service[]>>('/org/services');
  },

  async createService(payload: Partial<Service>): Promise<ApiResponse<Service>> {
    return post<ApiResponse<Service>>('/org/services', payload);
  },

  // ---- Org Payments ----
  async createOrgPayment(payload: unknown): Promise<ApiResponse<unknown>> {
    return post<ApiResponse<unknown>>('/payments/create', payload);
  },

  async getOrgPaymentStatus(applicationId: string): Promise<ApiResponse<unknown>> {
    return get<ApiResponse<unknown>>(`/payments/${applicationId}`);
  },

  async listOrgPayments(): Promise<ApiResponse<OrgPaymentRecord[]>> {
    return get<ApiResponse<OrgPaymentRecord[]>>('/payments');
  },

  async listOrgPaymentNotifications(): Promise<ApiResponse<OrgPaymentNotification[]>> {
    return get<ApiResponse<OrgPaymentNotification[]>>('/payment-notifications');
  },

  async orgHealthCheck(): Promise<ApiResponse<{ status: string; service: string; timestamp: string }>> {
    return get<ApiResponse<{ status: string; service: string; timestamp: string }>>('/health', { skipAuth: true });
  },

  async processOrgPaymentCallback(payload: unknown): Promise<ApiResponse<unknown>> {
    return post<ApiResponse<unknown>>('/payments/callback', payload);
  },

  async expireOverduePayments(): Promise<ApiResponse<{ expired: number }>> {
    return post<ApiResponse<{ expired: number }>>('/payments/expire', {});
  },

  async getOrgStats(): Promise<ApiResponse<{
    totalRequests: number;
    pending: number;
    paid: number;
    expired: number;
    failed: number;
    feeCollected: number;
    verifiedTransactions: number;
    collectionTrend: { month: string; revenue: number }[];
  }>> {
    return get('/stats');
  },

  // ---- Settings ----
  async fetchFeePlans(): Promise<ApiResponse<FeePlan[]>> {
    return get<ApiResponse<FeePlan[]>>('/fee-plans');
  },

  async createFeePlan(payload: Pick<FeePlan, 'name' | 'amount' | 'frequency' | 'dueDay' | 'lateFee' | 'planType'>): Promise<ApiResponse<FeePlan>> {
    return post<ApiResponse<FeePlan>>('/fee-plans', payload);
  },

  async updateFeePlan(id: string, payload: Partial<Pick<FeePlan, 'name' | 'amount' | 'frequency' | 'dueDay' | 'lateFee' | 'planType'>>): Promise<ApiResponse<FeePlan>> {
    return put<ApiResponse<FeePlan>>(`/fee-plans/${id}`, payload);
  },

  async deleteFeePlan(id: string): Promise<ApiResponse<null>> {
    return del<ApiResponse<null>>(`/fee-plans/${id}`);
  },

  async fetchFeeHeads(): Promise<ApiResponse<unknown[]>> {
    return get<ApiResponse<unknown[]>>('/fee-heads');
  },

  async fetchScholarships(params: { status?: string } = {}): Promise<ApiResponse<unknown[]>> {
    const q = buildQuery({ status: params.status });
    return get<ApiResponse<unknown[]>>(`/scholarships${q}`);
  },

  async createScholarship(payload: { name: string; type: string; value: number; startDate: string; endDate: string | null; isLifetime: boolean }): Promise<ApiResponse<unknown>> {
    return post<ApiResponse<unknown>>('/scholarships', payload);
  },

  async updateScholarshipStatus(id: string, status: string): Promise<ApiResponse<unknown>> {
    return patch<ApiResponse<unknown>>(`/scholarships/${id}/status`, { status });
  },

  async fetchStudentScholarships(studentId: string): Promise<ApiResponse<unknown[]>> {
    return get<ApiResponse<unknown[]>>(`/students/${studentId}/scholarships`);
  },

  async fetchAllScholarshipAssignments(): Promise<ApiResponse<unknown[]>> {
    return get<ApiResponse<unknown[]>>('/scholarship-assignments');
  },

  async createScholarshipAssignment(payload: { studentId: string; scholarshipId: string; effectiveFrom: string }): Promise<ApiResponse<unknown>> {
    return post<ApiResponse<unknown>>('/scholarship-assignments', payload);
  },

  async updateScholarshipAssignment(id: string, status: string): Promise<ApiResponse<unknown>> {
    return patch<ApiResponse<unknown>>(`/scholarship-assignments/${id}/status`, { status });
  },

  async fetchPaymentPlanAssignments(): Promise<ApiResponse<PaymentPlanAssignment[]>> {
    return get<ApiResponse<PaymentPlanAssignment[]>>('/payment-plan-assignments');
  },

  async createPaymentPlanAssignment(payload: {
    studentId: string;
    feePlanId: string;
    assignedDate?: string;
    nextDueDate?: string | null;
    status?: PaymentPlanAssignment['status'];
    assignedVia?: PaymentPlanAssignment['assignedVia'];
  }): Promise<ApiResponse<PaymentPlanAssignment>> {
    return post<ApiResponse<PaymentPlanAssignment>>('/payment-plan-assignments', payload);
  },

  async updatePaymentPlanAssignment(id: string, payload: Partial<Pick<PaymentPlanAssignment, 'feePlanId' | 'status' | 'assignedVia' | 'assignedDate' | 'nextDueDate'>>): Promise<ApiResponse<PaymentPlanAssignment>> {
    return put<ApiResponse<PaymentPlanAssignment>>(`/payment-plan-assignments/${id}`, payload);
  },

  async deletePaymentPlanAssignment(id: string): Promise<ApiResponse<boolean>> {
    return del<ApiResponse<boolean>>(`/payment-plan-assignments/${id}`);
  },

  async fetchSetting<T>(key: string): Promise<ApiResponse<T | null>> {
    return get<ApiResponse<T | null>>(`/settings/${encodeURIComponent(key)}`);
  },

  async saveSetting<T>(key: string, value: T): Promise<ApiResponse<T>> {
    return put<ApiResponse<T>>(`/settings/${encodeURIComponent(key)}`, { value });
  },

  // ---- Webhook Config ----
  async fetchWebhookConfig(): Promise<ApiResponse<{ notificationUrl: string | null; webhookSecretHint: string | null }>> {
    return get<ApiResponse<{ notificationUrl: string | null; webhookSecretHint: string | null }>>('/org/webhook-config');
  },

  async saveWebhookConfig(payload: { notificationUrl: string; webhookSecret?: string }): Promise<ApiResponse<{ saved: boolean }>> {
    return put<ApiResponse<{ saved: boolean }>>('/org/webhook-config', {
      notification_url: payload.notificationUrl,
      webhook_secret: payload.webhookSecret,
    });
  },

  async testWebhookConfig(): Promise<ApiResponse<{ status: number; ok: boolean; error?: string }>> {
    return post<ApiResponse<{ status: number; ok: boolean; error?: string }>>('/org/webhook-config/test', {});
  },

  async generateInvoices(payload: { month?: string } = {}): Promise<ApiResponse<{ month: string; created: number; skipped: number }>> {
    return post<ApiResponse<{ month: string; created: number; skipped: number }>>('/invoices/generate', payload);
  },

  // ---- Notifications ----
  async fetchNotifications(): Promise<ApiResponse<AppNotification[]>> {
    return get<ApiResponse<AppNotification[]>>('/notifications');
  },

  async markNotificationRead(id: string): Promise<ApiResponse<boolean>> {
    return put<ApiResponse<boolean>>(`/notifications/${id}/read`);
  },

  async markAllNotificationsRead(): Promise<ApiResponse<boolean>> {
    return put<ApiResponse<boolean>>('/notifications/read-all');
  },

  async deleteNotification(id: string): Promise<ApiResponse<boolean>> {
    return del<ApiResponse<boolean>>(`/notifications/${id}`);
  },

  async clearNotifications(): Promise<ApiResponse<boolean>> {
    return del<ApiResponse<boolean>>('/notifications');
  },

  // ---- Audit ----
  async fetchAuditLogs(params: { page?: number; pageSize?: number; action?: string; entity?: string; search?: string } = {}): Promise<ApiResponse<AuditLog[]>> {
    const q = buildQuery({ page: params.page, pageSize: params.pageSize, action: params.action, entity: params.entity, search: params.search });
    return get<ApiResponse<AuditLog[]>>(`/audit-logs${q}`);
  },

  // ---- Reports ----
  async getDashboardStats(): Promise<ApiResponse<{
    totalStudents: number; totalInvoices: number; paidRevenue: number;
    pendingAmount: number; overdueAmount: number; overdueInvoices: number;
    totalTransactions: number; totalLateFees: number;
  }>> {
    return get('/reports/dashboard');
  },

  async getCollectionTrend(): Promise<ApiResponse<{ month: string; total: number }[]>> {
    return get('/reports/collection-trend');
  },

  async getMonthlyTrend(): Promise<ApiResponse<{ month: string; collected: number }[]>> {
    return get('/reports/monthly-trend');
  },

  async getCollectionByFeePlan(): Promise<ApiResponse<{ name: string; value: number }[]>> {
    return get('/reports/collection-by-fee-plan');
  },

  async getPlatformSummary(): Promise<ApiResponse<{
    totalTenants: number; totalUsers: number; totalStudents: number;
    totalApplicants: number; totalRevenue: number;
  }>> {
    return get('/reports/platform-summary');
  },

  // ---- Admin Dev Tools ----
  async verifyHash(hash: string, plaintext: string): Promise<ApiResponse<{ match: boolean }>> {
    return post<ApiResponse<{ match: boolean }>>('/admin/tools/verify-hash', { hash, plaintext });
  },

  // ---- Admin Impersonation ----
  async impersonateUser(userId: string): Promise<ApiResponse<{ token: string; user: User }>> {
    return post<ApiResponse<{ token: string; user: User }>>('/auth/impersonate', { userId });
  },
};
