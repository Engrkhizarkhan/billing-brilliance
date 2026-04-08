import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import type { Student, Invoice } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { TablePagination } from '@/components/TablePagination';
import { EmptyState } from '@/components/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Receipt, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { usePaymentStore } from '@/store/paymentStore';

const InvoiceList = () => {
  const paymentVersion = usePaymentStore((state) => state.version);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [generating, setGenerating] = useState(false);
  const [genDialogOpen, setGenDialogOpen] = useState(false);
  const [genMonth, setGenMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const { data: studentsData, loading: ls } = useApiQuery(() => api.fetchStudents({}), []);
  const { data: invoicesData, loading: li, refetch: refetchInvoices } = useApiQuery(() => api.fetchInvoices({}), [paymentVersion]);
  const students = (studentsData || []) as Student[];
  const invoices = (invoicesData || []) as Invoice[];
  const loading = ls || li;

  const handleGenerateInvoices = async () => {
    setGenerating(true);
    try {
      const result = await api.generateInvoices({ month: genMonth });
      const { created, skipped } = result as unknown as { created: number; skipped: number };
      toast.success(`Generated ${created} invoice${created !== 1 ? 's' : ''} for ${genMonth}${skipped > 0 ? ` (${skipped} skipped — already existed)` : ''}`);
      setGenDialogOpen(false);
      refetchInvoices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate invoices');
    } finally {
      setGenerating(false);
    }
  };

  const classOptions = useMemo(
    () => Array.from(new Set(students.map((student) => student.class))).sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, ''))),
    [students]
  );

  const classByConsumerNumber = useMemo(
    () => new Map(students.map((student) => [student.consumerNumber, student.class])),
    [students]
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

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Invoices</h1>
          <p className="page-description">Track and manage fee invoices • {filtered.length} records</p>
        </div>
        <Dialog open={genDialogOpen} onOpenChange={setGenDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="default" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Generate Invoices
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Monthly Invoices</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Creates one invoice per student who has an active fee plan assignment. Skips students who already have an invoice for the selected month.
              </p>
              <div className="space-y-2">
                <Label htmlFor="gen-month">Month</Label>
                <Input
                  id="gen-month"
                  type="month"
                  value={genMonth}
                  onChange={(e) => setGenMonth(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setGenDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleGenerateInvoices} disabled={generating || !genMonth}>
                  {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Generate
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
