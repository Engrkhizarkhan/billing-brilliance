import { api } from '@/lib/api';
import { post } from '@/lib/apiClient';
import {
  OrgCreatePaymentRequest,
  OrgCreatePaymentResponse,
  OrgHealthResponse,
  OrgPaymentCallbackRequest,
  OrgPaymentCallbackResponse,
  OrgPaymentNotification,
  OrgPaymentRecord,
  OrgPaymentStatusResponse,
  OrgRequestSecurityContext,
} from '@/types';

const WEBHOOK_SECRET = import.meta.env.VITE_ORG_WEBHOOK_SECRET || 'org-webhook-dev-secret';
const CALLBACK_URL = import.meta.env.VITE_ORG_CALLBACK_URL || '/api/payment/callback';
const DEFAULT_EXPIRY_HOURS = Number(import.meta.env.VITE_ORG_PAYMENT_EXPIRY_HOURS || 48);
const REQUIRE_WEBHOOK_SIGNATURE = (import.meta.env.VITE_ORG_REQUIRE_WEBHOOK_SIGNATURE || 'true').toLowerCase() !== 'false';

const toSignatureHash = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
};

const callbackSignaturePayload = (callback: OrgPaymentCallbackRequest) => {
  const paidAt = callback.paidAt || '';
  return `${callback.billId}|${callback.status}|${callback.transactionId}|${paidAt}|${WEBHOOK_SECRET}`;
};

export const generateWebhookSignature = (callback: OrgPaymentCallbackRequest) =>
  toSignatureHash(callbackSignaturePayload(callback));

export const createPayment = async (
  request: OrgCreatePaymentRequest,
  _context?: OrgRequestSecurityContext
): Promise<OrgCreatePaymentResponse> => {
  const res = await api.createOrgPayment(request);
  return res.data as OrgCreatePaymentResponse;
};

export const getPaymentStatus = async (
  applicationId: string,
  _context?: OrgRequestSecurityContext
): Promise<OrgPaymentStatusResponse> => {
  const res = await api.getOrgPaymentStatus(applicationId);
  return res.data as OrgPaymentStatusResponse;
};

export const processPaymentCallback = async (
  callback: OrgPaymentCallbackRequest,
  _context?: OrgRequestSecurityContext
): Promise<OrgPaymentCallbackResponse> => {
  const res = await post<{ data: OrgPaymentCallbackResponse }>('/payments/callback', callback);
  return res.data;
};

export const listPayments = async (): Promise<OrgPaymentRecord[]> => {
  const res = await api.listOrgPayments();
  return res.data;
};

export const listPaymentNotifications = async (): Promise<OrgPaymentNotification[]> => {
  const res = await api.listOrgPaymentNotifications();
  return res.data;
};

export const expireOverduePayments = async (): Promise<number> => {
  const res = await post<{ data: { expired: number } }>('/payments/expire');
  return res.data.expired;
};

export const healthCheck = async (): Promise<OrgHealthResponse> => {
  const res = await api.orgHealthCheck();
  return res.data as OrgHealthResponse;
};

export const orgPaymentControllerConfig = {
  billIdPattern: 'ORG-<payment_sequence>',
  callbackUrl: CALLBACK_URL,
  endpoints: {
    create: '/api/payments/create',
    callback: '/api/payment/callback',
    notifyOrg: '/api/org/payment-status',
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
