import { Applicant, OrgPosting, Service } from '@/types';

let _postingsCache: OrgPosting[] = [];
let _servicesCache: Service[] = [];

export const setOrgFinanceCache = (postings: OrgPosting[], services: Service[]) => {
  _postingsCache = postings;
  _servicesCache = services;
};

export const ORG_CONSUMER_PREFIX = '1234562001';

export type OrgPostingSource = 'posting' | 'service' | 'unknown';

export interface ResolvedOrgPosting {
  id: string;
  title: string;
  applicationFee: number;
  source: OrgPostingSource;
}

export const isOrgConsumerNumber = (consumerNumber: string) =>
  consumerNumber.startsWith(ORG_CONSUMER_PREFIX);

export const resolveApplicantOrgPosting = (applicant: Applicant): ResolvedOrgPosting => {
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

export const getOrgApplicationFee = (applicant: Applicant) =>
  resolveApplicantOrgPosting(applicant).applicationFee;

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

export const getOrgApplicants = (allApplicants: Applicant[]) =>
  allApplicants.filter((applicant) => isOrgConsumerNumber(applicant.consumerNumber));
