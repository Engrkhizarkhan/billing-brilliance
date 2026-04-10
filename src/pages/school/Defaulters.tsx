import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import type { Student } from '@/types';
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

  const { data: studentsData, loading: ls } = useApiQuery(() => api.fetchStudents({ pageSize: 9999 }), []);
  const { data: summaryData, loading: li } = useApiQuery(() => api.fetchStudentFinancialSummary(), []);
  const students = (studentsData || []) as Student[];
  const loading = ls || li;

  const financialByStudentId = useMemo(() => {
    const summaries = (summaryData || []) as import('@/types').StudentFinancialSummary[];
    const map = new Map<string, { totalDue: number; overdueMonths: number; riskTier: string }>();
    summaries.forEach((s) => {
      const overdueMonths = Number(s.overdueMonths) || 0;
      const totalDue = parseFloat(String(s.totalDue)) || 0;
      const riskTier = overdueMonths >= 3 ? 'critical' : overdueMonths >= 2 ? 'high-risk' : overdueMonths >= 1 ? 'watch' : 'none';
      map.set(s.studentId, { totalDue, overdueMonths, riskTier });
    });
    return map;
  }, [summaryData]);

  const classOptions = useMemo(
    () => Array.from(new Set(students.map((student) => student.class))).sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, ''))),
    []
  );

  const defaulters = students
    .filter((student) => student.status === 'active')
    .map((student) => {
      const financial = financialByStudentId.get(student.id);
      if (!financial || financial.totalDue <= 0) return null;
      return { student, financial };
    })
    .filter((item): item is { student: Student; financial: { totalDue: number; overdueMonths: number; riskTier: string } } => item !== null);

  const filtered = defaulters.filter((item) => {
    const query = search.toLowerCase();
    const matchSearch = item.student.name.toLowerCase().includes(query)
      || item.student.cnic.includes(search)
      || item.student.consumerNumber.includes(search)
      || (item.student.rollNumber || '').toLowerCase().includes(query);
    const matchClass = classFilter === 'all' || item.student.class === classFilter;
    const matchRisk = riskFilter === 'all' || item.financial.riskTier === riskFilter;
    return matchSearch && matchClass && matchRisk;
  });

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const totalDue = filtered.reduce((sum, item) => sum + item.financial.totalDue, 0);

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Defaulters</h1>
          <p className="page-description">Students with outstanding dues • {filtered.length} defaulters • Total: {formatPKR(totalDue)}</p>
        </div>
        <ExportButton data={filtered.map((item) => ({ Name: item.student.name, Father: item.student.fatherName, Class: item.student.class, CNIC: item.student.cnic, Phone: item.student.phone, AmountDue: item.financial.totalDue, OverdueMonths: item.financial.overdueMonths, Risk: item.financial.riskTier }))} filename="defaulters" />
      </div>

      <FilterBar
        searchPlaceholder="Search by name, consumer #, roll #, or CNIC..."
        onSearch={v => { setSearch(v); setPage(1); }}
        filters={[
          {
            key: 'class',
            label: 'Class',
            options: classOptions.map((className) => ({ value: className, label: className })),
          },
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
        {paginated.length === 0 ? (
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
              {paginated.map(({ student, financial }) => (
                <TableRow key={student.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-sm">{student.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{student.consumerNumber}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{student.fatherName}</TableCell>
                  <TableCell><span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md">{student.class} {student.section}</span></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{student.cnic}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{student.phone}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold text-destructive">{formatPKR(financial.totalDue)}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-destructive">{financial.overdueMonths} mo</TableCell>
                  <TableCell><span className="text-xs capitalize bg-warning/10 text-warning px-2 py-0.5 rounded-md">{financial.riskTier}</span></TableCell>
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

export default Defaulters;
