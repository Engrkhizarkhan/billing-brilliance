import { useMemo, useState } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { TablePagination } from '@/components/TablePagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatPKR } from '@/lib/formatters';
import { usePaymentStore } from '@/store/paymentStore';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { OrgPaymentRecord } from '@/types';
import { Loader2 } from 'lucide-react';
import { RecordPaymentDialog } from '@/components/RecordPaymentDialog';

const mapPaymentToInvoiceStatus = (status: 'pending' | 'paid' | 'failed' | 'expired'): 'paid' | 'pending' | 'overdue' => {
  if (status === 'paid') return 'paid';
  if (status === 'pending') return 'pending';
  return 'overdue';
};

const OrgInvoices = () => {
  const paymentVersion = usePaymentStore((state) => state.version);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const apiStatus = statusFilter === 'overdue' ? 'overdue' : statusFilter === 'all' ? undefined : statusFilter;
  const { data: paymentsData, meta, loading } = useApiQuery(
    () => api.listOrgPayments({ page, pageSize, search: search || undefined, status: apiStatus }),
    [paymentVersion, page, pageSize, search, apiStatus]
  );
  const rawPayments = useMemo(() => (paymentsData || []) as OrgPaymentRecord[], [paymentsData]);

  const invoiceRows = useMemo(
    () => rawPayments.map((payment) => ({
      id: payment.id,
      invoiceNumber: payment.billId,
      applicationId: payment.applicationId,
      applicantId: payment.applicantId,
      postingId: payment.postingId,
      amount: payment.amount,
      status: mapPaymentToInvoiceStatus(payment.status),
      dueDate: payment.dueDate,
      consumerNumber: payment.consumerNumber || '',
    })),
    [rawPayments]
  );

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Invoices</h1>
        <p className="page-description">Payment invoices generated from payment records for your organization.</p>
      </div>

      <FilterBar
        searchPlaceholder="Search by bill_id, application_id, applicant_id, or posting_id..."
        onSearch={(value) => { setSearch(value); setPage(1); }}
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'paid', label: 'Paid' },
              { value: 'pending', label: 'Pending' },
              { value: 'overdue', label: 'Overdue' },
            ],
          },
        ]}
        onFilterChange={(_, value) => { setStatusFilter(value); setPage(1); }}
      />

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>bill_id</TableHead>
              <TableHead>application_id</TableHead>
              <TableHead>applicant_id</TableHead>
              <TableHead>posting_id</TableHead>
              <TableHead>amount</TableHead>
              <TableHead>status</TableHead>
              <TableHead>due_date</TableHead>
              <TableHead>actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoiceRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">
                  No invoices match your filters.
                </TableCell>
              </TableRow>
            ) : (
              invoiceRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.invoiceNumber}</TableCell>
                  <TableCell className="font-mono text-xs">{row.applicationId}</TableCell>
                  <TableCell className="font-mono text-xs">{row.applicantId}</TableCell>
                  <TableCell className="font-mono text-xs">{row.postingId}</TableCell>
                  <TableCell className="font-mono text-sm">{formatPKR(row.amount)}</TableCell>
                  <TableCell><StatusBadge status={row.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.dueDate}</TableCell>
                  <TableCell>{row.status !== 'paid' && row.consumerNumber ? <RecordPaymentDialog targetType="org_payment" targetId={row.id} consumerNumber={row.consumerNumber} payerLabel={row.applicationId} amount={Number(row.amount)} onSuccess={() => usePaymentStore.getState().bump()} /> : null}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <TablePagination
          total={Number((meta as { total?: number } | null)?.total || 0)}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
};

export default OrgInvoices;
