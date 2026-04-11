import { useMemo, useState } from 'react';
import { FilterBar } from '@/components/FilterBar';
import { StatusBadge } from '@/components/StatusBadge';
import { TablePagination } from '@/components/TablePagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPKR } from '@/lib/formatters';
import { usePaymentStore } from '@/store/paymentStore';
import { EteaPaymentRecord } from '@/types';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Copy, Loader2 } from 'lucide-react';

const ETEAPaymentHistory = () => {
  const paymentVersion = usePaymentStore((state) => state.version);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: paymentsData, loading: loadingPayments } = useApiQuery(() => api.listEteaPayments(), [paymentVersion]);
  const paymentRecords = useMemo(() => (paymentsData || []) as EteaPaymentRecord[], [paymentsData]);

  const filteredPayments = useMemo(() => {
    const query = search.toLowerCase();
    return paymentRecords.filter((payment) => {
      const matchesSearch =
        payment.applicationId.toLowerCase().includes(query) ||
        payment.applicantId.toLowerCase().includes(query) ||
        payment.postingId.toLowerCase().includes(query) ||
        (payment.consumerNumber || '').toLowerCase().includes(query) ||
        (payment.transactionId || '').toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
      return Boolean(matchesSearch && matchesStatus);
    });
  }, [paymentRecords, search, statusFilter]);

  const paginatedPayments = filteredPayments.slice((page - 1) * pageSize, page * pageSize);

  if (loadingPayments && paymentRecords.length === 0)
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Payment History</h1>
        <p className="page-description">All ETEA payment records — search, filter, and audit past requests.</p>
      </div>

      <FilterBar
        searchPlaceholder="Search by application_id, applicant_id, posting_id, consumer #, or transaction_id..."
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
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
        onFilterChange={(_, value) => {
          setStatusFilter(value);
          setPage(1);
        }}
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedPayments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-6">
                  No payment records match your filters.
                </TableCell>
              </TableRow>
            ) : (
              paginatedPayments.map((payment) => (
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
                          onClick={() => {
                            navigator.clipboard.writeText(payment.consumerNumber!);
                            toast.success('Copied');
                          }}
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <TablePagination
          total={filteredPayments.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

    </div>
  );
};

export default ETEAPaymentHistory;
