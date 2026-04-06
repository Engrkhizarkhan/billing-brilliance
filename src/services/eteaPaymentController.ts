import {
  createEteaPaymentRecord,
  getEteaPaymentByApplicationId,
  getEteaPaymentByBillId,
  getEteaPaymentNotifications,
  getEteaPaymentRecords,
  recordEteaPaymentNotification,
  transactions,
  updateEteaPaymentRecord,
} from '@/data/mockData';
import { resolvePostingById } from '@/lib/eteaFinance';
import {
  EteaCreatePaymentRequest,
  EteaCreatePaymentResponse,
  EteaHealthResponse,
  EteaPaymentCallbackRequest,
  EteaPaymentCallbackResponse,
  EteaPaymentNotification,
  EteaPaymentRecord,
  EteaPaymentStatusResponse,
  EteaRequestSecurityContext,
  OneBillCreateBillRequest,
} from '@/types';
import { notifyPaymentUpdate } from '@/store/paymentStore';

const CALLBACK_URL = import.meta.env.VITE_ETEA_CALLBACK_URL || '/api/payment/callback';
const ETEA_API_KEY = import.meta.env.VITE_ETEA_API_KEY || 'etea-dev-key';
const ALLOWED_IPS = (import.meta.env.VITE_ETEA_ALLOWED_IPS || '127.0.0.1,::1')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const WEBHOOK_SECRET = import.meta.env.VITE_ETEA_WEBHOOK_SECRET || 'etea-webhook-dev-secret';
const REQUIRE_WEBHOOK_SIGNATURE = (import.meta.env.VITE_ETEA_REQUIRE_WEBHOOK_SIGNATURE || 'true').toLowerCase() !== 'false';
const DEFAULT_EXPIRY_HOURS = Number(import.meta.env.VITE_ETEA_PAYMENT_EXPIRY_HOURS || 48);

const callbackIdempotencyLog = new Map<string, EteaPaymentCallbackResponse>();

const withDefaultSecurityContext = (
  context?: EteaRequestSecurityContext
): Required<Pick<EteaRequestSecurityContext, 'apiKey' | 'sourceIp' | 'protocol' | 'webhookSignature' | 'idempotencyKey'>> => ({
  apiKey: context?.apiKey || ETEA_API_KEY,
  sourceIp: context?.sourceIp || ALLOWED_IPS[0] || '127.0.0.1',
  protocol: context?.protocol || 'https',
  webhookSignature: context?.webhookSignature || '',
  idempotencyKey: context?.idempotencyKey || '',
});

const toSignatureHash = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
};

const callbackSignaturePayload = (callback: EteaPaymentCallbackRequest) => {
  const paidAt = callback.paidAt || '';
  return `${callback.billId}|${callback.status}|${callback.transactionId}|${paidAt}|${WEBHOOK_SECRET}`;
};

export const generateWebhookSignature = (callback: EteaPaymentCallbackRequest) =>
  toSignatureHash(callbackSignaturePayload(callback));

const normalizeCreateRequest = (request: EteaCreatePaymentRequest) => {
  const applicantId = (request.applicantId || request.applicant_id || '').trim();
  const applicationId = (request.applicationId || request.application_id || '').trim();
  const postingId = (request.postingId || request.posting_id || '').trim();
  const dueDate = (request.dueDate || request.due_date || '').trim();
  const description = request.description?.trim();
  const customerName = (request.customerName || request.customer_name || applicantId || 'Applicant').trim();

  return {
    applicantId,
    applicationId,
    postingId,
    amount: request.amount,
    dueDate,
    description,
    customerName,
  };
};

const assertSecurity = (
  context?: EteaRequestSecurityContext,
  options?: {
    requireWebhookSignature?: boolean;
    callback?: EteaPaymentCallbackRequest;
  }
) => {
  const resolved = withDefaultSecurityContext(context);

  if (resolved.protocol !== 'https') {
    throw new Error('HTTPS is required');
  }

  if (resolved.apiKey !== ETEA_API_KEY) {
    throw new Error('Invalid API key');
  }

  if (ALLOWED_IPS.length > 0 && !ALLOWED_IPS.includes(resolved.sourceIp)) {
    throw new Error('Source IP is not whitelisted');
  }

  const shouldValidateWebhookSignature = Boolean(options?.requireWebhookSignature && options.callback && REQUIRE_WEBHOOK_SIGNATURE);
  if (shouldValidateWebhookSignature) {
    const expected = generateWebhookSignature(options!.callback!);
    if (!resolved.webhookSignature || resolved.webhookSignature !== expected) {
      throw new Error('Invalid webhook signature');
    }
  }
};

const generateBillIdForPayment = (paymentId: string) => {
  const sequence = paymentId.replace(/^PAY-/, '').trim();
  return sequence ? `ETEA-${sequence}` : `ETEA-${Date.now()}`;
};

const addHours = (isoDate: string, hours: number) => {
  const parsed = new Date(isoDate);
  parsed.setHours(parsed.getHours() + hours);
  return parsed.toISOString();
};

const toIsoDate = (input: string) => {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid date format');
  }
  return parsed.toISOString();
};

const isExpired = (payment: EteaPaymentRecord) => {
  if (payment.status !== 'pending') return false;
  return new Date(payment.expiryDate).getTime() <= Date.now();
};

const ensurePaymentNotStale = (payment: EteaPaymentRecord) => {
  if (!isExpired(payment)) return payment;
  const updated = updateEteaPaymentRecord(payment.id, { status: 'expired' });
  if (updated) {
    notifyPaymentUpdate();
    return updated;
  }
  return payment;
};

const toOneBillCreatePayload = (payment: EteaPaymentRecord, customerName: string): OneBillCreateBillRequest => ({
  billId: payment.billId,
  amount: payment.amount,
  dueDate: payment.dueDate,
  customerName,
  callbackUrl: payment.callbackUrl,
  description: payment.description || `Payment for application ${payment.applicationId}`,
  bill_id: payment.billId,
  due_date: payment.dueDate,
  customer_name: customerName,
  callback_url: payment.callbackUrl,
});

const toStatusResponse = (applicationId: string, payment?: EteaPaymentRecord): EteaPaymentStatusResponse => {
  if (!payment) {
    return {
      applicationId,
      status: 'not_found',
    };
  }

  return {
    applicationId,
    status: payment.status,
    payment,
  };
};

const notifyETEA = (payment: EteaPaymentRecord): EteaPaymentNotification => {
  return recordEteaPaymentNotification({
    applicationId: payment.applicationId,
    paymentId: payment.id,
    billId: payment.billId,
    status: payment.status,
  });
};

const upsertTransactionFromEteaPayment = (payment: EteaPaymentRecord, consumerNumber?: string) => {
  if (!payment.transactionId) return;

  const existing = transactions.find((transaction) => transaction.transactionId === payment.transactionId);
  const status = payment.status === 'paid' ? 'completed' : payment.status === 'failed' ? 'failed' : 'pending';
  const date = (payment.paidAt || payment.createdAt).slice(0, 10);

  if (existing) {
    existing.status = status;
    existing.date = date;
    existing.amount = payment.amount;
    existing.consumerNumber = consumerNumber || existing.consumerNumber;
    existing.billerName = 'ETEA KPK';
    return;
  }

  transactions.unshift({
    id: `etea-${payment.id}-${Date.now()}`,
    transactionId: payment.transactionId,
    consumerNumber: consumerNumber || payment.billId,
    amount: payment.amount,
    status,
    date,
    billerName: 'ETEA KPK',
  });
};

export const createPayment = (
  request: EteaCreatePaymentRequest,
  context?: EteaRequestSecurityContext
): EteaCreatePaymentResponse => {
  assertSecurity(context);

  const normalized = normalizeCreateRequest(request);

  if (!normalized.applicantId) {
    throw new Error('applicant_id is required');
  }

  if (!normalized.applicationId) {
    throw new Error('application_id is required');
  }

  if (!normalized.postingId) {
    throw new Error('posting_id is required');
  }

  if (!normalized.dueDate) {
    throw new Error('due_date is required');
  }

  if (normalized.amount <= 0) {
    throw new Error('amount must be greater than zero');
  }

  const applicationId = normalized.applicationId;
  if (!applicationId) {
    throw new Error('Application ID is required');
  }

  const posting = resolvePostingById(normalized.postingId);

  const existing = getEteaPaymentByApplicationId(applicationId);
  if (existing) {
    const current = ensurePaymentNotStale(existing);
    return {
      paymentId: current.id,
      billId: current.billId,
      status: current.status,
      payment: current,
      oneBillRequest: toOneBillCreatePayload(current, normalized.customerName),
    };
  }

  const createdAt = new Date().toISOString();
  const dueDate = toIsoDate(normalized.dueDate).slice(0, 10);
  const expiryDate = addHours(createdAt, DEFAULT_EXPIRY_HOURS);
  const description =
    normalized.description ||
    (posting.source === 'unknown'
      ? `Payment for application ${applicationId}`
      : `${posting.title} application fee`);

  const provisional = createEteaPaymentRecord({
    applicationId,
    applicantId: normalized.applicantId,
    postingId: normalized.postingId,
    billId: 'PENDING',
    amount: normalized.amount,
    status: 'pending',
    dueDate,
    expiryDate,
    createdAt,
    description,
    callbackUrl: CALLBACK_URL,
  });

  const payment =
    updateEteaPaymentRecord(provisional.id, { billId: generateBillIdForPayment(provisional.id) }) ||
    provisional;

  notifyPaymentUpdate();

  return {
    paymentId: payment.id,
    billId: payment.billId,
    status: payment.status,
    payment,
    oneBillRequest: toOneBillCreatePayload(payment, normalized.customerName),
  };
};

export const getPaymentStatus = (
  applicationId: string,
  context?: EteaRequestSecurityContext
): EteaPaymentStatusResponse => {
  assertSecurity(context);
  const payment = getEteaPaymentByApplicationId(applicationId);
  if (!payment) return toStatusResponse(applicationId);

  const current = ensurePaymentNotStale(payment);
  return toStatusResponse(applicationId, current);
};

export const processPaymentCallback = (
  callback: EteaPaymentCallbackRequest,
  context?: EteaRequestSecurityContext
): EteaPaymentCallbackResponse => {
  assertSecurity(context, { requireWebhookSignature: true, callback });

  const resolvedContext = withDefaultSecurityContext(context);
  const idempotencyKey = resolvedContext.idempotencyKey.trim();
  if (idempotencyKey) {
    const previous = callbackIdempotencyLog.get(idempotencyKey);
    if (previous) {
      return previous;
    }
  }

  const payment = getEteaPaymentByBillId(callback.billId);
  if (!payment) {
    const response: EteaPaymentCallbackResponse = {
      acknowledged: false,
      message: `Bill ID ${callback.billId} not found`,
    };
    if (idempotencyKey) {
      callbackIdempotencyLog.set(idempotencyKey, response);
    }
    return response;
  }

  const current = ensurePaymentNotStale(payment);

  const duplicateByTransactionId =
    callback.transactionId &&
    getEteaPaymentRecords().find(
      (record) => record.transactionId === callback.transactionId && record.billId !== callback.billId
    );
  if (duplicateByTransactionId) {
    const response: EteaPaymentCallbackResponse = {
      acknowledged: false,
      payment: current,
      message: `Transaction ID ${callback.transactionId} already used for another bill`,
    };
    if (idempotencyKey) {
      callbackIdempotencyLog.set(idempotencyKey, response);
    }
    return response;
  }

  if (current.status === 'paid' && callback.status === 'paid') {
    const response: EteaPaymentCallbackResponse = {
      acknowledged: true,
      payment: current,
      message: 'Duplicate callback ignored; payment already marked paid',
    };
    if (idempotencyKey) {
      callbackIdempotencyLog.set(idempotencyKey, response);
    }
    return response;
  }

  const updates: Partial<Omit<EteaPaymentRecord, 'id'>> = {
    status: callback.status,
    transactionId: callback.transactionId,
  };

  if (callback.status === 'paid') {
    updates.paidAt = callback.paidAt || new Date().toISOString();
  }

  const updated = updateEteaPaymentRecord(current.id, updates);
  if (!updated) {
    const response: EteaPaymentCallbackResponse = {
      acknowledged: false,
      message: 'Payment update failed',
    };
    if (idempotencyKey) {
      callbackIdempotencyLog.set(idempotencyKey, response);
    }
    return response;
  }

  upsertTransactionFromEteaPayment(updated, updated.applicantId || updated.billId);

  notifyETEA(updated);
  notifyPaymentUpdate();

  const response: EteaPaymentCallbackResponse = {
    acknowledged: true,
    payment: updated,
    message: `Callback processed. Payment marked ${updated.status}`,
  };
  if (idempotencyKey) {
    callbackIdempotencyLog.set(idempotencyKey, response);
  }

  return response;
};

export const healthCheck = (): EteaHealthResponse => ({
  status: 'ok',
  service: 'etea-payment-controller',
  timestamp: new Date().toISOString(),
});

export const expireOverduePayments = () => {
  let expiredCount = 0;
  getEteaPaymentRecords().forEach((payment) => {
    const updated = ensurePaymentNotStale(payment);
    if (updated.status === 'expired' && payment.status !== 'expired') {
      expiredCount += 1;
    }
  });

  return expiredCount;
};

export const listPayments = () => [...getEteaPaymentRecords()];

export const listPaymentNotifications = () => getEteaPaymentNotifications();

export const eteaPaymentControllerConfig = {
  billIdPattern: 'ETEA-<payment_sequence>',
  callbackUrl: CALLBACK_URL,
  endpoints: {
    create: '/api/payments/create',
    callback: '/api/payment/callback',
    notifyEtea: '/api/etea/payment-status',
  },
  expiryHours: DEFAULT_EXPIRY_HOURS,
  security: {
    httpsOnly: true,
    apiKeyAuth: true,
    ipWhitelisting: true,
    webhookSignatureVerification: REQUIRE_WEBHOOK_SIGNATURE,
    idempotencyProtection: true,
  },
};
