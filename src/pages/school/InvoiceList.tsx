import { useMemo, useState } from 'react';
import { invoices, students } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { TablePagination } from '@/components/TablePagination';
import { EmptyState } from '@/components/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Receipt } from 'lucide-react';

const InvoiceList = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const classOptions = useMemo(
    () => Array.from(new Set(students.map((student) => student.class))).sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, ''))),
    []
  );

  const classByConsumerNumber = useMemo(
    () => new Map(students.map((student) => [student.consumerNumber, student.class])),
    []
  );

  const filtered = invoices.filter((inv) => {
    const matchSearch =
      inv.studentName.toLowerCase().includes(search.toLowerCase()) ||
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.consumerNumber.includes(search);
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    const invoiceClass = classByConsumerNumber.get(inv.consumerNumber) || '-';
    const matchClass = classFilter === 'all' || invoiceClass === classFilter;
    return matchSearch && matchStatus && matchClass;
  });

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Invoices</h1>
        <p className="page-description">Track and manage fee invoices • {filtered.length} records</p>
      </div>
      <FilterBar
        searchPlaceholder="Search invoices by student, invoice #, or consumer #..."
        onSearch={(value) => { setSearch(value); setPage(1); }}
        filters={[
          {
            key: 'status', label: 'Status',
            options: [
              { value: 'pending', label: 'Pending' },
              { value: 'paid', label: 'Paid' },
              { value: 'overdue', label: 'Overdue' },
            ],
          },
          {
            key: 'class',
            label: 'Class',
            options: classOptions.map((className) => ({ value: className, label: className })),
          },
        ]}
        onFilterChange={(key, value) => {
          if (key === 'status') setStatusFilter(value);
          if (key === 'class') setClassFilter(value);
          setPage(1);
        }}
      />
      <div className="table-container">
        {paginated.length === 0 ? (
          <EmptyState icon={Receipt} title="No invoices found" description="No invoices match your current search or filter criteria." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Month</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono">{inv.invoiceNumber}</TableCell>
                  <TableCell className="font-medium">{inv.studentName}</TableCell>
                  <TableCell>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md">{classByConsumerNumber.get(inv.consumerNumber) || '-'}</span>
                  </TableCell>
                  <TableCell>{inv.month}</TableCell>
                  <TableCell>₨ {inv.amount.toLocaleString()}</TableCell>
                  <TableCell><StatusBadge status={inv.status} /></TableCell>
                  <TableCell>{inv.dueDate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <TablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>
    </div>
  );
};

export default InvoiceList;
