import { useMemo, useState } from 'react';
import { students, getStudentFinancialSnapshot } from '@/data/mockData';
import { FilterBar } from '@/components/FilterBar';
import { ExportButton } from '@/components/ExportButton';
import { TablePagination } from '@/components/TablePagination';
import { EmptyState } from '@/components/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AlertTriangle, MessageSquare } from 'lucide-react';
import { formatPKR } from '@/lib/formatters';
import { toast } from 'sonner';

const Defaulters = () => {
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const financialByStudentId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getStudentFinancialSnapshot>>();
    students.forEach((student) => {
      map.set(student.id, getStudentFinancialSnapshot(student.id));
    });
    return map;
  }, []);

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
    .filter((item): item is { student: (typeof students)[number]; financial: ReturnType<typeof getStudentFinancialSnapshot> } => item !== null);

  const filtered = defaulters.filter((item) => {
    const query = search.toLowerCase();
    const matchSearch = item.student.name.toLowerCase().includes(query) || item.student.cnic.includes(search);
    const matchClass = classFilter === 'all' || item.student.class === classFilter;
    const matchRisk = riskFilter === 'all' || item.financial.riskTier === riskFilter;
    return matchSearch && matchClass && matchRisk;
  });

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const totalDue = filtered.reduce((sum, item) => sum + item.financial.totalDue, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Defaulters</h1>
          <p className="page-description">Students with outstanding dues • {filtered.length} defaulters • Total: {formatPKR(totalDue)}</p>
        </div>
        <div className="flex gap-2">
          <ExportButton data={filtered.map((item) => ({ Name: item.student.name, Father: item.student.fatherName, Class: item.student.class, CNIC: item.student.cnic, Phone: item.student.phone, AmountDue: item.financial.totalDue, OverdueMonths: item.financial.overdueMonths, Risk: item.financial.riskTier }))} filename="defaulters" />
          <Button variant="outline" size="sm" className="rounded-lg" onClick={() => toast.success('SMS reminders sent to all defaulters')}>
            <MessageSquare className="w-4 h-4 mr-1.5" />Send Reminders
          </Button>
        </div>
      </div>

      <FilterBar
        searchPlaceholder="Search defaulters by name or CNIC..."
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
                <TableHead className="text-xs font-semibold">Father Name</TableHead>
                <TableHead className="text-xs font-semibold">Class</TableHead>
                <TableHead className="text-xs font-semibold">CNIC</TableHead>
                <TableHead className="text-xs font-semibold">Phone</TableHead>
                <TableHead className="text-xs font-semibold text-right">Amount Due</TableHead>
                <TableHead className="text-xs font-semibold text-right">Overdue</TableHead>
                <TableHead className="text-xs font-semibold">Risk</TableHead>
                <TableHead className="text-xs font-semibold w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map(({ student, financial }) => (
                <TableRow key={student.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-sm">{student.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{student.fatherName}</TableCell>
                  <TableCell><span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md">{student.class} {student.section}</span></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{student.cnic}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{student.phone}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold text-destructive">{formatPKR(financial.totalDue)}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-destructive">{financial.overdueMonths} mo</TableCell>
                  <TableCell><span className="text-xs capitalize bg-warning/10 text-warning px-2 py-0.5 rounded-md">{financial.riskTier}</span></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toast.success(`SMS sent to ${student.name}'s parent`)}>
                      <MessageSquare className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
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
