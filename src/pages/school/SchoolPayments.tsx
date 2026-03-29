import { useState } from 'react';
import { transactions } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { TablePagination } from '@/components/TablePagination';
import { EmptyState } from '@/components/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard } from 'lucide-react';
import { formatPKR } from '@/lib/formatters';

const SchoolPayments = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filtered = transactions.filter((transaction) => {
    const query = search.toLowerCase();
    const matchesSearch =
      transaction.transactionId.toLowerCase().includes(query) ||
      transaction.consumerNumber.includes(search) ||
      transaction.billerName.toLowerCase().includes(query) ||
      transaction.date.includes(search);
    const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalAmount = filtered.reduce((sum, transaction) => sum + transaction.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Payments</h1>
        <p className="page-description">Payment history • {filtered.length} records • Total: {formatPKR(totalAmount)}</p>
      </div>

      <FilterBar
        searchPlaceholder="Search by txn ID, consumer #, biller, or date..."
        onSearch={(value) => { setSearch(value); setPage(1); }}
        filters={[{
          key: 'status',
          label: 'Status',
          options: [
            { value: 'completed', label: 'Completed' },
            { value: 'pending', label: 'Pending' },
            { value: 'failed', label: 'Failed' },
          ],
        }]}
        onFilterChange={(_, value) => { setStatusFilter(value); setPage(1); }}
      />

      <div className="table-container">
        {paginated.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No payments found"
            description="No transactions match your current search or filter criteria."
          />
        ) : (
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
              {paginated.map((transaction) => (
                <TableRow key={transaction.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-sm">{transaction.transactionId}</TableCell>
                  <TableCell className="text-sm">{transaction.billerName}</TableCell>
                  <TableCell className="font-mono text-xs">{transaction.consumerNumber}</TableCell>
                  <TableCell>{formatPKR(transaction.amount)}</TableCell>
                  <TableCell><StatusBadge status={transaction.status} /></TableCell>
                  <TableCell>{transaction.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <TablePagination
          total={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
};

export default SchoolPayments;
