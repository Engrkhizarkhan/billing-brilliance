import { useDeferredValue, useState } from 'react';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import type { StudentDirectoryRecord } from '@/types';
import { FilterBar } from '@/components/FilterBar';
import { ExportButton } from '@/components/ExportButton';
import { TablePagination } from '@/components/TablePagination';
import { EmptyState } from '@/components/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { formatPKR } from '@/lib/formatters';

const Defaulters = () => {
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const deferredSearch = useDeferredValue(search);

  const { data, meta, loading } = useApiQuery(
    () => api.fetchStudents({
      page,
      pageSize,
      search: deferredSearch || undefined,
      className: classFilter === 'all' ? undefined : classFilter,
      status: 'active',
      defaulter: 'with_due',
      risk: riskFilter === 'all' ? undefined : riskFilter,
    }),
    [page, pageSize, deferredSearch, classFilter, riskFilter]
  );

  const defaulters = (data || []) as StudentDirectoryRecord[];
  const total = meta?.total ?? 0;
  const totalDue = meta?.filteredTotalDue ?? 0;
  const classOptions = (meta?.facets.classes ?? []).map((item) => item.name);

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Defaulters</h1>
          <p className="page-description">Students with outstanding dues · {total} defaulters · Total: {formatPKR(totalDue)}</p>
        </div>
        <ExportButton
          data={defaulters.map((student) => ({
            Name: student.name,
            Father: student.fatherName,
            Class: student.class,
            CNIC: student.cnic,
            Phone: student.phone,
            AmountDue: student.totalDue,
            OverdueMonths: student.overdueMonths,
            Risk: student.riskTier,
          }))}
          filename={`defaulters-page-${page}`}
        />
      </div>

      <FilterBar
        searchPlaceholder="Search by name, consumer #, roll #, or CNIC..."
        onSearch={(value) => { setSearch(value); setPage(1); }}
        filters={[
          { key: 'class', label: 'Class', options: classOptions.map((className) => ({ value: className, label: className })) },
          {
            key: 'risk',
            label: 'Risk Tier',
            options: [
              { value: 'watch', label: 'Watch' },
              { value: 'high-risk', label: 'High Risk' },
              { value: 'critical', label: 'Critical' },
            ],
          },
        ]}
        onFilterChange={(key, value) => {
          if (key === 'class') setClassFilter(value);
          if (key === 'risk') setRiskFilter(value);
          setPage(1);
        }}
      />

      <div className="table-container">
        {defaulters.length === 0 ? (
          <EmptyState icon={AlertTriangle} title="No defaulters" description="All students are up to date with their fee payments!" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Student</TableHead>
                <TableHead className="text-xs font-semibold">Consumer #</TableHead>
                <TableHead className="text-xs font-semibold">Father Name</TableHead>
                <TableHead className="text-xs font-semibold">Class</TableHead>
                <TableHead className="text-xs font-semibold">CNIC</TableHead>
                <TableHead className="text-xs font-semibold">Phone</TableHead>
                <TableHead className="text-xs font-semibold text-right">Amount Due</TableHead>
                <TableHead className="text-xs font-semibold text-right">Overdue Months</TableHead>
                <TableHead className="text-xs font-semibold">Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {defaulters.map((student) => (
                <TableRow key={student.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-sm">{student.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{student.consumerNumber}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{student.fatherName}</TableCell>
                  <TableCell><span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md">{student.class} {student.section}</span></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{student.cnic}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{student.phone}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold text-destructive">{formatPKR(student.totalDue)}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-destructive">{student.overdueMonths} mo</TableCell>
                  <TableCell><span className="text-xs capitalize bg-warning/10 text-warning px-2 py-0.5 rounded-md">{student.riskTier}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <TablePagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </div>
    </div>
  );
};

export default Defaulters;
