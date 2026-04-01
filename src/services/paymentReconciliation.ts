import { BillPaymentResult } from '@/types';
import {
  auditLogs,
  findInvoiceForConsumer,
  findStudentByConsumerNumber,
  getRuntimeBillPayments,
  markInvoiceStatus,
  recordRuntimeBillPayment,
  transactions,
} from '@/data/mockData';
import { notifyPaymentUpdate } from '@/store/paymentStore';

export const reconcileBillPayment = (payment: BillPaymentResult) => {
  const resolvedStudentId = payment.studentId || findStudentByConsumerNumber(payment.consumerNumber)?.id;
  const invoice = findInvoiceForConsumer(payment.consumerNumber, payment.invoiceNumber);

  if (invoice) {
    markInvoiceStatus(invoice, 'paid');
  }

  const alreadyRecorded = getRuntimeBillPayments().some((entry) => entry.reference === payment.reference);
  if (!alreadyRecorded && resolvedStudentId) {
    recordRuntimeBillPayment({
      id: `rt-${payment.reference}`,
      studentId: resolvedStudentId,
      consumerNumber: payment.consumerNumber,
      amount: payment.amount,
      date: payment.paidAt.slice(0, 10),
      reference: payment.reference,
      voucherNumber: payment.invoiceNumber,
      note: payment.notes || 'Payment posted via BillPayment',
    });
  }

  transactions.unshift({
    id: `txn-${payment.reference}`,
    transactionId: payment.reference,
    consumerNumber: payment.consumerNumber,
    amount: payment.amount,
    status: 'completed',
    date: payment.paidAt.slice(0, 10),
    billerName: payment.billerName || '1BILL School',
  });

  auditLogs.unshift({
    id: `audit-${payment.reference}`,
    userId: 'system',
    userName: 'System',
    action: 'payment',
    entity: 'transaction',
    entityId: payment.reference,
    details: `Payment ${payment.amount.toLocaleString()} received for ${payment.consumerNumber}`,
    timestamp: new Date(payment.paidAt).toISOString(),
    ip: '127.0.0.1',
  });

  notifyPaymentUpdate();

  return { invoice, studentId: resolvedStudentId };
};
