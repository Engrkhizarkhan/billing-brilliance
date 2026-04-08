import { Applicant, ETEAPosting, Service } from '@/types';

let _postingsCache: ETEAPosting[] = [];
let _servicesCache: Service[] = [];

export const setEteaFinanceCache = (postings: ETEAPosting[], services: Service[]) => {
  _postingsCache = postings;
  _servicesCache = services;
};

export const ETEA_CONSUMER_PREFIX = '1234562001';

export type EteaPostingSource = 'posting' | 'service' | 'unknown';

export interface ResolvedEteaPosting {
  id: string;
  title: string;
  applicationFee: number;
  source: EteaPostingSource;
}

export const isEteaConsumerNumber = (consumerNumber: string) =>
  consumerNumber.startsWith(ETEA_CONSUMER_PREFIX);

export const resolveApplicantPosting = (applicant: Applicant): ResolvedEteaPosting => {
  const posting = _postingsCache.find((item) => item.id === applicant.serviceId);
  if (posting) {
    return {
      id: posting.id,
      title: posting.title,
      applicationFee: posting.applicationFee,
      source: 'posting',
    };
  }

  const service = _servicesCache.find((item) => item.id === applicant.serviceId);
  if (service) {
    return {
      id: service.id,
      title: service.name,
      applicationFee: service.amount,
      source: 'service',
    };
  }

  return {
    id: applicant.serviceId,
    title: applicant.serviceId,
    applicationFee: 0,
    source: 'unknown',
  };
};

export const resolvePostingById = (id: string) => {
  const posting = _postingsCache.find((item) => item.id === id);
  if (posting) {
    return {
      id: posting.id,
      title: posting.title,
      applicationFee: posting.applicationFee,
      source: 'posting' as const,
    };
  }

  const service = _servicesCache.find((item) => item.id === id);
  if (service) {
    return {
      id: service.id,
      title: service.name,
      applicationFee: service.amount,
      source: 'service' as const,
    };
  }

  return {
    id,
    title: id,
    applicationFee: 0,
    source: 'unknown' as const,
  };
};

export const getEteaApplicationFee = (applicant: Applicant) =>
  resolveApplicantPosting(applicant).applicationFee;

export const mapApplicantPaymentToInvoiceStatus = (
  paymentStatus: Applicant['paymentStatus']
): 'paid' | 'pending' | 'overdue' => {
  if (paymentStatus === 'paid') return 'paid';
  if (paymentStatus === 'partial') return 'pending';
  return 'overdue';
};

export const estimateDueDateFromAppliedDate = (appliedDate: string, days = 10) => {
  const parsed = new Date(`${appliedDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return appliedDate;
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().slice(0, 10);
};

export const getEteaApplicants = (allApplicants: Applicant[]) =>
  allApplicants.filter((applicant) => isEteaConsumerNumber(applicant.consumerNumber));
