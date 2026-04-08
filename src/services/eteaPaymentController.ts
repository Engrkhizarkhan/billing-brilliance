import { api } from '@/lib/api';
import { post } from '@/lib/apiClient';
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
} from '@/types';

const WEBHOOK_SECRET = import.meta.env.VITE_ETEA_WEBHOOK_SECRET || 'etea-webhook-dev-secret';
const CALLBACK_URL = import.meta.env.VITE_ETEA_CALLBACK_URL || '/api/payment/callback';
const DEFAULT_EXPIRY_HOURS = Number(import.meta.env.VITE_ETEA_PAYMENT_EXPIRY_HOURS || 48);
const REQUIRE_WEBHOOK_SIGNATURE = (import.meta.env.VITE_ETEA_REQUIRE_WEBHOOK_SIGNATURE || 'true').toLowerCase() !== 'false';

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

export const createPayment = async (
  request: EteaCreatePaymentRequest,
  _context?: EteaRequestSecurityContext
): Promise<EteaCreatePaymentResponse> => {
  const res = await api.createEteaPayment(request);
  return res.data as EteaCreatePaymentResponse;
};

export const getPaymentStatus = async (
  applicationId: string,
  _context?: EteaRequestSecurityContext
): Promise<EteaPaymentStatusResponse> => {
  const res = await api.getEteaPaymentStatus(applicationId);
  return res.data as EteaPaymentStatusResponse;
};

export const processPaymentCallback = async (
  callback: EteaPaymentCallbackRequest,
  _context?: EteaRequestSecurityContext
): Promise<EteaPaymentCallbackResponse> => {
  const res = await post<{ data: EteaPaymentCallbackResponse }>('/payments/callback', callback);
  return res.data;
};

export const listPayments = async (): Promise<EteaPaymentRecord[]> => {
  const res = await api.listEteaPayments();
  return res.data;
};

export const listPaymentNotifications = async (): Promise<EteaPaymentNotification[]> => {
  const res = await api.listEteaPaymentNotifications();
  return res.data;
};

export const expireOverduePayments = async (): Promise<number> => {
  const res = await post<{ data: { expired: number } }>('/payments/expire');
  return res.data.expired;
};

export const healthCheck = async (): Promise<EteaHealthResponse> => {
  const res = await api.eteaHealthCheck();
  return res.data as EteaHealthResponse;
};

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
