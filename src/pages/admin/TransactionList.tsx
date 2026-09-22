import { TablePagination } from '@/components/TablePagination';
import { QueryError } from '@/components/QueryError';
import { useState } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePaymentStore } from '@/store/paymentStore';
import { Loader2 } from 'lucide-react';

const TransactionList = () => {
  const paymentVersion = usePaymentStore((state) => state.version);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const deferredSearch = useDebouncedValue(search.trim());

  const { data: rawTransactions, meta, loading, error: queryError0 } = useApiQuery(
    () => api.fetchTransactions({ page, pageSize, search: deferredSearch || undefined, status: statusFilter === 'all' ? undefined : statusFilter }),
    [paymentVersion, deferredSearch, statusFilter, page, pageSize]
  );

  const transactions = (rawTransactions || []) as Array<{ id: string; transactionId: string; consumerNumber: string; amount: number; status: string; date: string; billerName: string }>;

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  if (queryError0) return <QueryError message={queryError0} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Transactions</h1>
        <p className="page-description">All platform transactions</p>
      </div>
      <FilterBar
        searchPlaceholder="Search by ID or consumer number..."
        onSearch={(value) => { setSearch(value); setPage(1); }}
        filters={[{
          key: 'status', label: 'Status',
          options: [
            { value: 'completed', label: 'Completed' },
            { value: 'pending', label: 'Pending' },
            { value: 'failed', label: 'Failed' },
          ],
        }]}
        onFilterChange={(_, v) => { setStatusFilter(v); setPage(1); }}
      />
      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Biller</TableHead>
              <TableHead>Consumer Number</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-sm">{t.transactionId}</TableCell>
                <TableCell>{t.billerName}</TableCell>
                <TableCell className="font-mono text-xs">{t.consumerNumber}</TableCell>
                <TableCell>₨ {t.amount.toLocaleString()}</TableCell>
                <TableCell><StatusBadge status={t.status} /></TableCell>
                <TableCell>{t.date}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination total={meta?.total || 0} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>
    </div>
  );
};

export default TransactionList;
