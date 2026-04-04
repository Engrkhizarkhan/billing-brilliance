import {
  BillInquiryRequest,
  BillInquiryResponse,
  BillPaymentRequest,
  BillPaymentResult,
  BillStatus,
  BundlePackage,
  FetchBundleResponse,
  OneLinkInquiryReservedFields,
} from '@/types';
import {
  billBundles,
  billers,
  findInvoiceForConsumer,
  findStudentByConsumerNumber,
  getStudentFinancialSnapshot,
  invoices,
  markInvoiceStatus,
  recordRuntimeBillPayment,
  students,
} from '@/data/mockData';

const DEFAULT_BASE_URL = 'https://sandbox.onebill.local';
const BASE_URL = import.meta.env.VITE_ONEBILL_BASE_URL || DEFAULT_BASE_URL;
const USE_MOCK = (import.meta.env.VITE_ONEBILL_USE_MOCK ?? 'true') !== 'false';
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_ONEBILL_TIMEOUT_MS || 8000);
const DEFAULT_ONELINK_USERNAME = import.meta.env.VITE_ONELINK_USERNAME || 'demo-user';
const DEFAULT_ONELINK_PASSWORD = import.meta.env.VITE_ONELINK_PASSWORD || 'demo-pass';
const DEFAULT_ONELINK_BANK_MNEMONIC = import.meta.env.VITE_ONELINK_BANK_MNEMONIC || 'MBLINK01';

const padRight = (value: string, length: number) => value.slice(0, length).padEnd(length, ' ');

export const buildOneLinkInquiryReserved = (fields: OneLinkInquiryReservedFields = {}) => {
  const cnic = padRight((fields.cnic || '').replace(/\D/g, ''), 13);
  const accountId = padRight(fields.accountId || '', 28);
  const bundleId = padRight(fields.bundleId || '', 100);
  const supportingInfo1 = padRight(fields.supportingInfo1 || '', 100);
  const supportingInfo2 = padRight(fields.supportingInfo2 || '', 144);
  return `${cnic}${accountId}${bundleId}${supportingInfo1}${supportingInfo2}`;
};

const toOneLinkInquiryPayload = (payload: BillInquiryRequest) => {
  const reserved = payload.reserved || buildOneLinkInquiryReserved(payload.reservedFields);
  return {
    username: padRight(payload.username || DEFAULT_ONELINK_USERNAME, 60).trimEnd(),
    password: padRight(payload.password || DEFAULT_ONELINK_PASSWORD, 60).trimEnd(),
    consumer_number: padRight(payload.consumerNumber.trim(), 24).trimEnd(),
    bank_mnemonic: padRight(payload.bankMnemonic || DEFAULT_ONELINK_BANK_MNEMONIC, 8).trimEnd(),
    reserved: padRight(reserved, 400),
  };
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number) => {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error('Request timed out')), timeoutMs);
  });
  const result = await Promise.race([promise, timeoutPromise]);
  if (timeoutHandle) clearTimeout(timeoutHandle);
  return result as T;
};

const mapInvoiceStatusToBillStatus = (invoiceStatus?: string): BillStatus => {
  if (invoiceStatus === 'paid') return 'paid';
  if (invoiceStatus === 'overdue') return 'overdue';
  return 'unpaid';
};

const mockBillInquiry = async (payload: BillInquiryRequest): Promise<BillInquiryResponse> => {
  const consumer = payload.consumerNumber.trim();
  const student = findStudentByConsumerNumber(consumer);
  if (!student) {
    return { found: false, status: 'not_found', message: 'Consumer number not found' };
  }

  const invoice = findInvoiceForConsumer(consumer, payload.voucherNumber);
  const snapshot = getStudentFinancialSnapshot(student.id);
  const biller = billers.find((biller) => biller.id === student.billerId);

  const amount = invoice?.amount ?? Math.max(snapshot.totalDue, 0) ?? 0;
  const dueDate = invoice?.dueDate ?? '2025-04-10';
  const status: BillStatus | 'not_found' = invoice ? mapInvoiceStatusToBillStatus(invoice.status) : snapshot.totalDue > 0 ? 'unpaid' : 'paid';

  return {
    found: true,
    studentId: student.id,
    studentName: student.name,
    className: student.class,
    section: student.section,
    billId: student.billId,
    consumerNumber: consumer,
    invoiceNumber: invoice?.invoiceNumber,
    amount,
    dueDate,
    status,
    billerCode: biller?.billerCode,
    billerName: biller?.name,
    currency: 'PKR',
    message: status === 'paid' ? 'Already paid' : 'Bill is payable',
  };
};

const mockBillPayment = async (payload: BillPaymentRequest): Promise<BillPaymentResult> => {
  const consumer = payload.consumerNumber.trim();
  const student = findStudentByConsumerNumber(consumer);
  const invoice = findInvoiceForConsumer(consumer, payload.voucherNumber);
  const biller = billers.find((b) => b.id === student?.billerId);
  const amount = payload.amount || invoice?.amount || 0;
  const reference = payload.transactionId || `TXN-${Date.now()}`;
  const receiptNumber = `RCPT-${Date.now()}`;

  if (invoice) {
    markInvoiceStatus(invoice, 'paid');
  }

  if (student) {
    recordRuntimeBillPayment({
      id: `rt-${Date.now()}`,
      studentId: student.id,
      consumerNumber: consumer,
      amount,
      date: payload.paidAt.slice(0, 10),
      reference,
      voucherNumber: payload.voucherNumber,
      channel: payload.channel,
      note: payload.notes || 'Payment posted via 1BILL mock',
    });
  }

  return {
    receiptNumber,
    status: 'paid',
    amount,
    paidAt: payload.paidAt,
    consumerNumber: consumer,
    reference,
    invoiceNumber: invoice?.invoiceNumber,
    studentId: student?.id,
    billId: student?.billId,
    billerName: biller?.name,
    notes: payload.notes,
  };
};

const mockFetchBundle = async (): Promise<FetchBundleResponse> => {
  return { bundles: billBundles as BundlePackage[], fetchedAt: new Date().toISOString() };
};

export const billInquiry = async (payload: BillInquiryRequest): Promise<BillInquiryResponse> => {
  if (USE_MOCK) {
    return mockBillInquiry(payload);
  }

  const oneLinkPayload = toOneLinkInquiryPayload(payload);

  const response = await withTimeout(
    fetch(`${BASE_URL}/api/1.0/Payments/BillInquiry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(oneLinkPayload),
    }),
    REQUEST_TIMEOUT_MS,
  );

  if (!response.ok) {
    return { found: false, status: 'not_found', message: `BillInquiry failed (${response.status})` };
  }

  const data = (await response.json()) as BillInquiryResponse;
  return data;
};

export const billPayment = async (payload: BillPaymentRequest): Promise<BillPaymentResult> => {
  if (USE_MOCK) {
    return mockBillPayment(payload);
  }

  const response = await withTimeout(
    fetch(`${BASE_URL}/api/1.0/Payments/BillPayment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    REQUEST_TIMEOUT_MS,
  );

  if (!response.ok) {
    throw new Error(`BillPayment failed (${response.status})`);
  }

  const data = (await response.json()) as BillPaymentResult;
  return data;
};

export const fetchBundle = async (): Promise<FetchBundleResponse> => {
  if (USE_MOCK) {
    return mockFetchBundle();
  }

  const response = await withTimeout(
    fetch(`${BASE_URL}/v1/Transaction/FetchBundle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }),
    REQUEST_TIMEOUT_MS,
  );

  if (!response.ok) {
    throw new Error(`FetchBundle failed (${response.status})`);
  }

  const data = (await response.json()) as FetchBundleResponse;
  return data;
};

export const billInquiry1Link = billInquiry;

export const onebillConfig = {
  baseUrl: BASE_URL,
  useMock: USE_MOCK,
  timeoutMs: REQUEST_TIMEOUT_MS,
  oneLink: {
    username: DEFAULT_ONELINK_USERNAME,
    bankMnemonic: DEFAULT_ONELINK_BANK_MNEMONIC,
  },
};
