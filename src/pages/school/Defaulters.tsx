import { useState } from 'react';
import { students } from '@/data/mockData';
import { FilterBar } from '@/components/FilterBar';
import { ExportButton } from '@/components/ExportButton';
import { TablePagination } from '@/components/TablePagination';
import { EmptyState } from '@/components/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AlertTriangle, MessageSquare, Ban } from 'lucide-react';
import { formatPKR } from '@/lib/formatters';
import { toast } from 'sonner';

const Defaulters = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const defaulters = students.filter(s => s.balance > 0 && s.status === 'active');
  const filtered = defaulters.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.cnic.includes(search));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const totalDue = filtered.reduce((sum, s) => sum + s.balance, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Defaulters</h1>
          <p className="page-description">Students with outstanding dues • {filtered.length} defaulters • Total: {formatPKR(totalDue)}</p>
        </div>
        <div className="flex gap-2">
          <ExportButton data={filtered.map(s => ({ Name: s.name, Father: s.fatherName, Class: s.class, CNIC: s.cnic, Phone: s.phone, Balance: s.balance }))} filename="defaulters" />
          <Button variant="outline" size="sm" className="rounded-lg" onClick={() => toast.success('SMS reminders sent to all defaulters')}>
            <MessageSquare className="w-4 h-4 mr-1.5" />Send Reminders
          </Button>
        </div>
      </div>

      <FilterBar searchPlaceholder="Search defaulters by name or CNIC…" onSearch={v => { setSearch(v); setPage(1); }} />

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
                <TableHead className="text-xs font-semibold w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map(s => (
                <TableRow key={s.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-sm">{s.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.fatherName}</TableCell>
                  <TableCell><span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md">{s.class} {s.section}</span></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{s.cnic}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.phone}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold text-destructive">{formatPKR(s.balance)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toast.success(`SMS sent to ${s.name}'s parent`)}>
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
