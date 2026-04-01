import { useState } from 'react';
import { transactions } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePaymentStore } from '@/store/paymentStore';

const TransactionList = () => {
  const paymentVersion = usePaymentStore((state) => state.version);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  void paymentVersion;

  const filtered = transactions.filter((t) => {
    const matchSearch = t.transactionId.toLowerCase().includes(search.toLowerCase()) || t.consumerNumber.includes(search);
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Transactions</h1>
        <p className="page-description">All platform transactions</p>
      </div>
      <FilterBar
        searchPlaceholder="Search by ID or consumer number..."
        onSearch={setSearch}
        filters={[{
          key: 'status', label: 'Status',
          options: [
            { value: 'completed', label: 'Completed' },
            { value: 'pending', label: 'Pending' },
            { value: 'failed', label: 'Failed' },
          ],
        }]}
        onFilterChange={(_, v) => setStatusFilter(v)}
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
            {filtered.map((t) => (
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
      </div>
    </div>
  );
};

export default TransactionList;
