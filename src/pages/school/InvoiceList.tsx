import { useState } from 'react';
import { invoices } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const InvoiceList = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = invoices.filter((inv) => {
    const matchSearch = inv.studentName.toLowerCase().includes(search.toLowerCase()) || inv.invoiceNumber.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Invoices</h1>
        <p className="page-description">Track and manage fee invoices</p>
      </div>
      <FilterBar
        searchPlaceholder="Search invoices..."
        onSearch={setSearch}
        filters={[{
          key: 'status', label: 'Status',
          options: [
            { value: 'pending', label: 'Pending' },
            { value: 'paid', label: 'Paid' },
            { value: 'overdue', label: 'Overdue' },
          ],
        }]}
        onFilterChange={(_, v) => setStatusFilter(v)}
      />
      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Month</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-mono">{inv.invoiceNumber}</TableCell>
                <TableCell className="font-medium">{inv.studentName}</TableCell>
                <TableCell>{inv.month}</TableCell>
                <TableCell>₨ {inv.amount.toLocaleString()}</TableCell>
                <TableCell><StatusBadge status={inv.status} /></TableCell>
                <TableCell>{inv.dueDate}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default InvoiceList;
