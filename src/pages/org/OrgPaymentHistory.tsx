import { useMemo, useState } from 'react';
import { FilterBar } from '@/components/FilterBar';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { StatusBadge } from '@/components/StatusBadge';
import { TablePagination } from '@/components/TablePagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatPKR } from '@/lib/formatters';
import { usePaymentStore } from '@/store/paymentStore';
import { OrgPaymentRecord } from '@/types';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Copy, Loader2 } from 'lucide-react';

const OrgPaymentHistory = () => {
  const paymentVersion = usePaymentStore((state) => state.version);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const deferredSearch = useDebouncedValue(search.trim());

  const { data: paymentsData, meta, loading: loadingPayments } = useApiQuery(
    () => api.listOrgPayments({ page, pageSize, search: deferredSearch || undefined, status: statusFilter === 'all' ? undefined : statusFilter }),
    [paymentVersion, page, pageSize, deferredSearch, statusFilter]
  );
  const paymentRecords = useMemo(() => (paymentsData || []) as OrgPaymentRecord[], [paymentsData]);

  if (loadingPayments && paymentRecords.length === 0)
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Payment History</h1>
        <p className="page-description">All payment records — search, filter, and audit past requests.</p>
      </div>

      <FilterBar
        searchPlaceholder="Search by application ID, applicant ID, posting ID, consumer #, or transaction ID…"
        onSearch={(value) => { setSearch(value); setPage(1); }}
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'pending', label: 'Pending' },
              { value: 'paid', label: 'Paid' },
              { value: 'failed', label: 'Failed' },
              { value: 'expired', label: 'Expired' },
            ],
          },
        ]}
        onFilterChange={(_, value) => { setStatusFilter(value); setPage(1); }}
      />

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>application_id</TableHead>
              <TableHead>applicant_id</TableHead>
              <TableHead>posting_id</TableHead>
              <TableHead>consumer #</TableHead>
              <TableHead>amount</TableHead>
              <TableHead>status</TableHead>
              <TableHead>created_at</TableHead>
              <TableHead>paid_at</TableHead>
              <TableHead>transaction_id</TableHead>
              <TableHead>actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paymentRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-6">
                  No payment records match your filters.
                </TableCell>
              </TableRow>
            ) : (
              paymentRecords.map((payment) => (
                <TableRow key={payment.applicationId}>
                  <TableCell className="font-mono text-xs">{payment.applicationId}</TableCell>
                  <TableCell className="font-mono text-xs">{payment.applicantId}</TableCell>
                  <TableCell className="font-mono text-xs">{payment.postingId}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {payment.consumerNumber ? (
                      <div className="flex items-center gap-1">
                        <span className="tracking-wider">{payment.consumerNumber}</span>
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => { void navigator.clipboard.writeText(payment.consumerNumber!); toast.success('Copied'); }}
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{formatPKR(payment.amount)}</TableCell>
                  <TableCell><StatusBadge status={payment.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{payment.createdAt}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{payment.paidAt || '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{payment.transactionId || '—'}</TableCell>
                  <TableCell><span className="text-xs text-muted-foreground">Read only</span></TableCell>
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
          pageSizeOptions={[10, 25, 30]}
        />
      </div>
    </div>
  );
};

export default OrgPaymentHistory;
