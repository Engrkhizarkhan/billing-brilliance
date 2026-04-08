import { BillPaymentResult } from '@/types';
import { notifyPaymentUpdate } from '@/store/paymentStore';

/**
 * Client-side reconciliation hook.
 * The real reconciliation (invoice status update, transaction creation, audit log)
 * happens server-side when the bill payment is posted via /api/billing/payment.
 * This function simply fires the local payment-update event so UI components
 * can refresh.
 */
export const reconcileBillPayment = (payment: BillPaymentResult) => {
  notifyPaymentUpdate();
  return { invoice: null, studentId: payment.studentId || null };
};
