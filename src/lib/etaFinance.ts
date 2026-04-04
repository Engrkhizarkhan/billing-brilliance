import { applicants, eteaPostings, services } from '@/data/mockData';
import { Applicant } from '@/types';

export const ETA_CONSUMER_PREFIX = '1234562001';

export type EtaPostingSource = 'posting' | 'service' | 'unknown';

export interface ResolvedEtaPosting {
  id: string;
  title: string;
  applicationFee: number;
  source: EtaPostingSource;
}

export const isEtaConsumerNumber = (consumerNumber: string) =>
  consumerNumber.startsWith(ETA_CONSUMER_PREFIX);

export const resolveApplicantPosting = (applicant: Applicant): ResolvedEtaPosting => {
  const posting = eteaPostings.find((item) => item.id === applicant.serviceId);
  if (posting) {
    return {
      id: posting.id,
      title: posting.title,
      applicationFee: posting.applicationFee,
      source: 'posting',
    };
  }

  const service = services.find((item) => item.id === applicant.serviceId);
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
  const posting = eteaPostings.find((item) => item.id === id);
  if (posting) {
    return {
      id: posting.id,
      title: posting.title,
      applicationFee: posting.applicationFee,
      source: 'posting' as const,
    };
  }

  const service = services.find((item) => item.id === id);
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

export const getEtaApplicationFee = (applicant: Applicant) =>
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

export const getEtaApplicants = () =>
  applicants.filter((applicant) => isEtaConsumerNumber(applicant.consumerNumber));
