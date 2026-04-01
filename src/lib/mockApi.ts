import {
  applicants,
  billBundles,
  billers,
  eteaPostings,
  feePlans,
  findInvoiceForConsumer,
  findStudentByConsumerNumber,
  generateConsumerNumber,
  generateLedger,
  getSchoolPaymentHistory,
  getStudentFinancialSnapshot,
  invoices,
  markInvoiceStatus,
  recordRuntimeBillPayment,
  services,
  students,
  transactions,
  updateStudentBusService,
} from '@/data/mockData';
import {
  Applicant,
  Biller,
  BillInquiryRequest,
  BillInquiryResponse,
  BillPaymentRequest,
  BillPaymentResult,
  BillStatus,
  ETEAPosting,
  FeePlan,
  Invoice,
  PaymentChannel,
  Service,
  Student,
  User,
  BundlePackage,
} from '@/types';

const DEFAULT_LATENCY = 220;
const DEFAULT_USER_PASSWORD = 'ChangeMe!123';

export type ApiResponse<T> = Promise<{ data: T; meta?: PaginationMeta; message?: string }>;
export type PaginationMeta = { page: number; pageSize: number; total: number };

const delay = (ms = DEFAULT_LATENCY) => new Promise((resolve) => setTimeout(resolve, ms));

const paginate = <T>(items: T[], page = 1, pageSize = 25) => {
  const total = items.length;
  const start = (page - 1) * pageSize;
  return {
    data: items.slice(start, start + pageSize),
    meta: { page, pageSize, total },
  };
};

const toBillStatus = (invoiceStatus: Invoice['status']): BillStatus => {
  if (invoiceStatus === 'paid') return 'paid';
  if (invoiceStatus === 'overdue') return 'overdue';
  return 'unpaid';
};

const nextId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const generateTempPassword = () => `${DEFAULT_USER_PASSWORD}-${Math.random().toString(36).slice(2, 4)}`;

let runtimeBillers = [...billers];
const nextBillerCode = () => {
  const numericCodes = runtimeBillers
    .map((b) => Number.parseInt(b.billerCode, 10))
    .filter((n) => Number.isFinite(n));
  const max = numericCodes.length ? Math.max(...numericCodes) : 1000;
  return String(max + 1);
};

const seedUsers: User[] = [
  { id: '1', name: 'Admin User', email: 'admin@example.com', role: 'admin', status: 'active' },
  { id: '2', name: 'School Admin', email: 'school@example.com', role: 'school', status: 'active' },
  { id: '3', name: 'ETA Manager', email: 'eta@example.com', role: 'eta', status: 'active' },
  { id: '4', name: 'John Doe', email: 'john@school.com', role: 'school', status: 'active' },
  { id: '5', name: 'Jane Smith', email: 'jane@agency.com', role: 'eta', status: 'banned' },
];

let runtimeUsers = [...seedUsers];

export const mockApi = {
  // ---- Auth (mock) ----
  async login(email: string, role: User['role']): ApiResponse<{ token: string; role: User['role'] }> {
    await delay();
    return { data: { token: `mock-token-${role}`, role }, message: 'Authenticated (mock)' };
  },

  // ---- Students ----
  async fetchStudents(params: { page?: number; pageSize?: number; search?: string; className?: string; status?: Student['status'] } = {}): ApiResponse<Student[]> {
    await delay();
    const { page = 1, pageSize = 25, search, className, status } = params;
    const filtered = students.filter((s) => {
      const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.cnic.includes(search) || s.rollNumber.toLowerCase().includes(search.toLowerCase());
      const matchClass = !className || s.class === className;
      const matchStatus = !status || s.status === status;
      return matchSearch && matchClass && matchStatus;
    });
    const { data, meta } = paginate(filtered, page, pageSize);
    return { data: structuredClone(data), meta };
  },

  async getStudent(studentId: string): ApiResponse<Student | null> {
    await delay();
    const found = students.find((s) => s.id === studentId) || null;
    return { data: found ? structuredClone(found) : null };
  },

  async createStudent(payload: Omit<Student, 'id' | 'consumerNumber' | 'billId'> & Partial<Pick<Student, 'consumerNumber' | 'billId'>>): ApiResponse<Student> {
    await delay();
    const id = nextId('s');
    const billId = payload.billId || `SCH-AUTO-${String(students.length + 1).padStart(5, '0')}`;
    const consumerNumber = payload.consumerNumber || generateConsumerNumber('1001', String(students.length + 1));
    const student: Student = { ...payload, id, billId, consumerNumber } as Student;
    students.push(student);
    return { data: structuredClone(student), message: 'Student created (session only)' };
  },

  async updateStudentBusService(studentId: string, updates: Parameters<typeof updateStudentBusService>[1]): ApiResponse<Student | null> {
    await delay();
    const updated = updateStudentBusService(studentId, updates);
    return { data: updated ? structuredClone(updated) : null };
  },

  async getStudentLedger(studentId: string): ApiResponse<ReturnType<typeof generateLedger>> {
    await delay();
    return { data: structuredClone(generateLedger(studentId)) };
  },

  async getStudentSnapshot(studentId: string): ApiResponse<ReturnType<typeof getStudentFinancialSnapshot>> {
    await delay();
    return { data: structuredClone(getStudentFinancialSnapshot(studentId)) };
  },

  // ---- Invoices & billing ----
  async fetchInvoices(params: { page?: number; pageSize?: number; status?: Invoice['status']; search?: string; billerId?: string } = {}): ApiResponse<Invoice[]> {
    await delay();
    const { page = 1, pageSize = 25, status, search, billerId } = params;
    const filtered = invoices.filter((inv) => {
      const matchStatus = !status || inv.status === status;
      const matchSearch = !search || inv.invoiceNumber.includes(search) || inv.studentName.toLowerCase().includes(search.toLowerCase());
      const matchBiller = !billerId || inv.billerId === billerId;
      return matchStatus && matchSearch && matchBiller;
    });
    const { data, meta } = paginate(filtered, page, pageSize);
    return { data: structuredClone(data), meta };
  },

  async billInquiry(request: BillInquiryRequest): ApiResponse<BillInquiryResponse> {
    await delay();
    const invoice = findInvoiceForConsumer(request.consumerNumber, request.voucherNumber);
    const student = findStudentByConsumerNumber(request.consumerNumber || request.studentRef || '');

    if (!invoice && !student) {
      return { data: { found: false, status: 'not_found', message: 'Bill not found' } };
    }

    const response: BillInquiryResponse = {
      found: Boolean(invoice || student),
      studentId: student?.id,
      studentName: student?.name,
      className: student?.class,
      section: student?.section,
      billId: student?.billId,
      consumerNumber: student?.consumerNumber,
      invoiceNumber: invoice?.invoiceNumber,
      amount: invoice?.amount,
      dueDate: invoice?.dueDate,
      status: invoice ? toBillStatus(invoice.status) : 'unpaid',
      billerCode: student ? billers.find((b) => b.id === student.billerId)?.billerCode : undefined,
      billerName: student ? billers.find((b) => b.id === student.billerId)?.name : undefined,
      currency: 'PKR',
      message: invoice ? 'Bill located' : 'Student located, invoice pending',
    };

    return { data: response };
  },

  async postBillPayment(request: BillPaymentRequest): ApiResponse<BillPaymentResult> {
    await delay();
    const invoice = findInvoiceForConsumer(request.consumerNumber, request.voucherNumber);
    const student = findStudentByConsumerNumber(request.consumerNumber);

    if (!invoice || !student) {
      return { data: {
        receiptNumber: 'N/A',
        status: 'unpaid',
        amount: request.amount,
        paidAt: request.paidAt,
        consumerNumber: request.consumerNumber,
        reference: request.transactionId,
        notes: 'Bill not found',
      }, message: 'Bill not found' };
    }

    recordRuntimeBillPayment({
      id: nextId('pay'),
      studentId: student.id,
      consumerNumber: request.consumerNumber,
      amount: request.amount,
      date: request.paidAt,
      reference: request.transactionId,
      voucherNumber: request.voucherNumber,
      channel: request.channel,
      note: request.notes,
    });

    markInvoiceStatus(invoice, 'paid');

    const result: BillPaymentResult = {
      receiptNumber: `RCPT-${Date.now()}`,
      status: 'paid',
      amount: request.amount,
      paidAt: request.paidAt,
      consumerNumber: request.consumerNumber,
      reference: request.transactionId,
      invoiceNumber: invoice.invoiceNumber,
      studentId: student.id,
      billId: student.billId,
      billerName: billers.find((b) => b.id === student.billerId)?.name,
      notes: request.notes,
    };

    return { data: result, message: 'Payment posted (mock)' };
  },

  // ---- Payments & transactions ----
  async fetchPaymentHistory(): ApiResponse<ReturnType<typeof getSchoolPaymentHistory>> {
    await delay();
    return { data: structuredClone(getSchoolPaymentHistory()) };
  },

  async fetchTransactions(): ApiResponse<typeof transactions> {
    await delay();
    return { data: structuredClone(transactions) };
  },

  // ---- Applicants & ETA ----
  async fetchApplicants(params: { page?: number; pageSize?: number; status?: Applicant['applicationStatus']; postingId?: string; search?: string } = {}): ApiResponse<Applicant[]> {
    await delay();
    const { page = 1, pageSize = 25, status, postingId, search } = params;
    const filtered = applicants.filter((a) => {
      const matchStatus = !status || a.applicationStatus === status;
      const matchPosting = !postingId || a.serviceId === postingId;
      const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.cnic.includes(search) || (a.rollNumber || '').includes(search);
      return matchStatus && matchPosting && matchSearch;
    });
    const { data, meta } = paginate(filtered, page, pageSize);
    return { data: structuredClone(data), meta };
  },

  async createApplicant(payload: Omit<Applicant, 'id' | 'consumerNumber' | 'billId' | 'paymentStatus' | 'applicationStatus' | 'appliedDate'>): ApiResponse<Applicant> {
    await delay();
    const idx = applicants.length + 1;
    const applicant: Applicant = {
      ...payload,
      id: `a${idx}`,
      consumerNumber: generateConsumerNumber('2001', String(idx)),
      billId: `ETA-MDCAT25-${String(idx).padStart(5, '0')}`,
      paymentStatus: 'pending',
      applicationStatus: 'submitted',
      appliedDate: new Date().toISOString().split('T')[0],
    };
    applicants.push(applicant);
    return { data: structuredClone(applicant), message: 'Applicant created (session only)' };
  },

  async assignRoll(applicantId: string, options: { rollNumber?: string; center?: string; slot?: string }): ApiResponse<Applicant | null> {
    await delay();
    const target = applicants.find((a) => a.id === applicantId);
    if (!target) return { data: null };
    target.rollNumber = options.rollNumber || target.rollNumber || `MDCAT-${String(300000 + applicants.indexOf(target)).padStart(6, '0')}`;
    target.testCenter = options.center || target.testCenter || 'Peshawar Test Center';
    target.applicationStatus = 'roll_assigned';
    return { data: structuredClone(target), message: 'Roll assigned (mock)' };
  },

  async recordResult(applicantId: string, marks: number, status: Applicant['applicationStatus'] = 'result_pending'): ApiResponse<Applicant | null> {
    await delay();
    const target = applicants.find((a) => a.id === applicantId);
    if (!target) return { data: null };
    target.marks = marks;
    target.applicationStatus = status;
    return { data: structuredClone(target), message: 'Result recorded (mock)' };
  },

  async fetchPostings(): ApiResponse<ETEAPosting[]> {
    await delay();
    return { data: structuredClone(eteaPostings) };
  },

  async fetchServices(): ApiResponse<Service[]> {
    await delay();
    return { data: structuredClone(services) };
  },

  // ---- Settings / bundles ----
  async fetchFeePlans(): ApiResponse<FeePlan[]> {
    await delay();
    return { data: structuredClone(feePlans) };
  },

  async fetchBundles(): ApiResponse<BundlePackage[]> {
    await delay();
    return { data: structuredClone(billBundles), message: 'Bundles fetched (mock)' };
  },

  // ---- Billers ----
  async fetchBillers(params: { page?: number; pageSize?: number; status?: Biller['status']; type?: Biller['type']; search?: string } = {}): ApiResponse<Biller[]> {
    await delay();
    const { page = 1, pageSize = 25, status, type, search } = params;
    const filtered = runtimeBillers.filter((b) => {
      const matchStatus = !status || b.status === status;
      const matchType = !type || b.type === type;
      const matchSearch = !search || b.name.toLowerCase().includes(search.toLowerCase()) || b.billerCode.includes(search);
      return matchStatus && matchType && matchSearch;
    });
    const { data, meta } = paginate(filtered, page, pageSize);
    return { data: structuredClone(data), meta };
  },

  async createBiller(payload: Pick<Biller, 'name' | 'type' | 'email' | 'phone'>): ApiResponse<Biller> {
    await delay();
    const biller: Biller = {
      id: nextId('b'),
      name: payload.name,
      type: payload.type,
      email: payload.email,
      phone: payload.phone,
      billerCode: nextBillerCode(),
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0],
    };
    runtimeBillers.push(biller);
    return { data: structuredClone(biller), message: 'Biller created (session only)' };
  },

  async updateBillerStatus(id: string, status: Biller['status']): ApiResponse<Biller | null> {
    await delay();
    const target = runtimeBillers.find((b) => b.id === id);
    if (!target) return { data: null };
    target.status = status;
    return { data: structuredClone(target), message: 'Biller status updated' };
  },

  // ---- Users ----
  async fetchUsers(params: { page?: number; pageSize?: number; role?: User['role']; status?: User['status']; search?: string } = {}): ApiResponse<User[]> {
    await delay();
    const { page = 1, pageSize = 25, role, status, search } = params;
    const filtered = runtimeUsers.filter((u) => {
      const matchRole = !role || u.role === role;
      const matchStatus = !status || u.status === status;
      const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
      return matchRole && matchStatus && matchSearch;
    });
    const { data, meta } = paginate(filtered, page, pageSize);
    return { data: structuredClone(data), meta };
  },

  async createUser(payload: { name: string; email: string; role: User['role']; status?: User['status'] }): ApiResponse<{ user: User; defaultPassword: string }> {
    await delay();
    const user: User = {
      id: nextId('u'),
      name: payload.name,
      email: payload.email,
      role: payload.role,
      status: payload.status || 'active',
    };
    const defaultPassword = generateTempPassword();
    runtimeUsers.push(user);
    return { data: { user: structuredClone(user), defaultPassword }, message: 'User created (session only)' };
  },

  async updateUserStatus(id: string, status: User['status']): ApiResponse<User | null> {
    await delay();
    const target = runtimeUsers.find((u) => u.id === id);
    if (!target) return { data: null };
    target.status = status;
    return { data: structuredClone(target), message: 'User status updated' };
  },
};

// structuredClone polyfill for older runtimes
function structuredClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
