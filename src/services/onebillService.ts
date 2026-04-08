import {
  BillInquiryRequest,
  BillInquiryResponse,
  BillPaymentRequest,
  BillPaymentResult,
  FetchBundleResponse,
  OneLinkInquiryReservedFields,
} from '@/types';
import { api } from '@/lib/api';

const DEFAULT_BASE_URL = '/api';
const BASE_URL = import.meta.env.VITE_ONEBILL_BASE_URL || DEFAULT_BASE_URL;

const padRight = (value: string, length: number) => value.slice(0, length).padEnd(length, ' ');

export const buildOneLinkInquiryReserved = (fields: OneLinkInquiryReservedFields = {}) => {
  const cnic = padRight((fields.cnic || '').replace(/\D/g, ''), 13);
  const accountId = padRight(fields.accountId || '', 28);
  const bundleId = padRight(fields.bundleId || '', 100);
  const supportingInfo1 = padRight(fields.supportingInfo1 || '', 100);
  const supportingInfo2 = padRight(fields.supportingInfo2 || '', 144);
  return `${cnic}${accountId}${bundleId}${supportingInfo1}${supportingInfo2}`;
};

export const billInquiry = async (payload: BillInquiryRequest): Promise<BillInquiryResponse> => {
  const result = await api.billInquiry(payload);
  return result.data;
};

export const billPayment = async (payload: BillPaymentRequest): Promise<BillPaymentResult> => {
  const result = await api.postBillPayment(payload);
  return result.data;
};

export const fetchBundle = async (pcid?: string): Promise<FetchBundleResponse> => {
  const result = await api.fetchBundles(pcid);
  return result.data;
};

export const billInquiry1Link = billInquiry;

export const onebillConfig = {
  baseUrl: BASE_URL,
  useMock: false,
};
