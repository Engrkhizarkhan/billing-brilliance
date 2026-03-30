import { useMemo, useState } from 'react';
import { getSchoolPaymentHistory, students } from '@/data/mockData';
import { FilterBar } from '@/components/FilterBar';
import { TablePagination } from '@/components/TablePagination';
import { EmptyState } from '@/components/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard } from 'lucide-react';
import { formatPKR } from '@/lib/formatters';

const monthLabelFromKey = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const SchoolPayments = () => {
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const paymentHistory = useMemo(() => getSchoolPaymentHistory(), []);

  const classOptions = useMemo(
    () => Array.from(new Set(students.map((student) => student.class))).sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, ''))),
    []
  );

  const sectionOptions = useMemo(() => {
    const pool = classFilter === 'all' ? students : students.filter((student) => student.class === classFilter);
    return Array.from(new Set(pool.map((student) => student.section))).sort((a, b) => a.localeCompare(b));
  }, [classFilter]);

  const monthOptions = useMemo(
    () => Array.from(new Set(paymentHistory.map((record) => record.date.slice(0, 7)))).sort((a, b) => b.localeCompare(a)),
    [paymentHistory]
  );

  const filtered = paymentHistory.filter((payment) => {
    const query = search.toLowerCase();
    const matchesSearch =
      payment.studentName.toLowerCase().includes(query) ||
      payment.rollNumber.toLowerCase().includes(query) ||
      payment.consumerNumber.includes(search) ||
      payment.reference.toLowerCase().includes(query) ||
      payment.billId.toLowerCase().includes(query) ||
      payment.date.includes(search);

    const matchesClass = classFilter === 'all' || payment.className === classFilter;
    const matchesSection = sectionFilter === 'all' || payment.section === sectionFilter;
    const matchesMonth = monthFilter === 'all' || payment.date.slice(0, 7) === monthFilter;

    return matchesSearch && matchesClass && matchesSection && matchesMonth;
  });

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalAmount = filtered.reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Payments</h1>
        <p className="page-description">Actual student payment history records (completed payments only) • {filtered.length} records • Total: {formatPKR(totalAmount)}</p>
      </div>

      <FilterBar
        searchPlaceholder="Search by student, roll #, consumer #, bill ID, txn ref, or date..."
        onSearch={(value) => { setSearch(value); setPage(1); }}
        filters={[
          {
            key: 'class',
            label: 'Class',
            options: classOptions.map((className) => ({ value: className, label: className })),
          },
          {
            key: 'section',
            label: 'Section',
            options: sectionOptions.map((section) => ({ value: section, label: section })),
          },
          {
            key: 'month',
            label: 'Month',
            options: monthOptions.map((monthKey) => ({ value: monthKey, label: monthLabelFromKey(monthKey) })),
          },
        ]}
        onFilterChange={(key, value) => {
          if (key === 'class') {
            setClassFilter(value);
            setSectionFilter('all');
          }
          if (key === 'section') setSectionFilter(value);
          if (key === 'month') setMonthFilter(value);
          setPage(1);
        }}
      />

      <div className="table-container">
        {paginated.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No payments found"
            description="No completed student payments match your current search or filter criteria."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Roll #</TableHead>
                <TableHead>Consumer #</TableHead>
                <TableHead>Bill ID</TableHead>
                <TableHead>Txn Ref</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((payment) => (
                <TableRow key={payment.id} className="hover:bg-muted/30">
                  <TableCell className="text-sm text-muted-foreground">{payment.date}</TableCell>
                  <TableCell className="font-medium text-sm">{payment.studentName}</TableCell>
                  <TableCell><span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-md">{payment.className} {payment.section}</span></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{payment.rollNumber}</TableCell>
                  <TableCell className="font-mono text-xs">{payment.consumerNumber}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{payment.billId}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{payment.reference}</TableCell>
                  <TableCell className="font-mono text-sm font-semibold text-success">{formatPKR(payment.amount)}</TableCell>
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
