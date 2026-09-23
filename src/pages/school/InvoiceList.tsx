import { QueryError } from '@/components/QueryError';
import { useState } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import type { Invoice, StudentDirectoryRecord } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { TablePagination } from '@/components/TablePagination';
import { EmptyState } from '@/components/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Receipt, Loader2, RefreshCw, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { usePaymentStore } from '@/store/paymentStore';
import { formatPKR } from '@/lib/formatters';

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    studentId: '',
    amount: '',
    month: new Date().toISOString().slice(0, 7),
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });
  const deferredSearch = useDebouncedValue(search.trim());

  const { data, meta, loading, refetch: refetchInvoices, error: queryError0 } = useApiQuery(
    () => api.fetchInvoices({
      page,
      pageSize,
      search: deferredSearch || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      className: classFilter === 'all' ? undefined : classFilter,
    }),
    [page, pageSize, deferredSearch, statusFilter, classFilter, paymentVersion]
  );
  const invoices = (data || []) as Invoice[];
  const { data: studentsData, error: queryError1 } = useApiQuery(
    () => api.fetchStudents({ page: 1, pageSize: 100, status: 'active' }),
    [createDialogOpen]
  );
  const students = (studentsData || []) as StudentDirectoryRecord[];
  const total = meta?.total ?? 0;
  const classOptions = (meta?.classes ?? []).map((item) => item.name);

  const handleDeleteInvoice = async (invoiceId: string, invoiceNumber: string) => {
    if (!window.confirm(`Delete invoice ${invoiceNumber}? This cannot be undone.`)) return;
    setDeletingId(invoiceId);
    try {
      await api.deleteInvoice(invoiceId);
      toast.success(`Invoice ${invoiceNumber} deleted`);
      await refetchInvoices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete invoice');
    } finally {
      setDeletingId(null);
    }
  };

  const handleGenerateInvoices = async () => {
    setGenerating(true);
    try {
      const result = await api.generateInvoices({ month: genMonth });
      const { created, skipped } = result.data as { created: number; skipped: number };
      toast.success(`Generated ${created} invoice${created !== 1 ? 's' : ''} for ${genMonth}${skipped > 0 ? ` (${skipped} skipped - already existed)` : ''}`);
      setGenDialogOpen(false);
      setPage(1);
      await refetchInvoices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate invoices');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateInvoice = async () => {
    const student = students.find((item) => item.id === createForm.studentId);
    if (!student) return toast.error('Select a student');
    if (!createForm.amount || Number(createForm.amount) <= 0) return toast.error('Enter a valid amount');
    if (!createForm.month || !createForm.dueDate) return toast.error('Billing month and due date are required');
    setCreating(true);
    try {
      await api.createInvoice({
        studentId: student.id,
        studentName: student.name,
        consumerNumber: student.consumerNumber,
        month: createForm.month,
        amount: Number(createForm.amount),
        dueDate: createForm.dueDate,
      });
      toast.success(`Invoice created for ${student.name}`);
      setCreateDialogOpen(false);
      setCreateForm({
        studentId: '', amount: '', month: new Date().toISOString().slice(0, 7),
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      });
      await refetchInvoices();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create invoice');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  if (queryError0 || queryError1) return <QueryError message={queryError0 || queryError1} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Invoices</h1>
          <p className="page-description">Track and manage fee invoices · {total} matching invoices</p>
        </div>
        <div className="flex gap-2">
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild><Button variant="outline" className="gap-2"><Plus className="w-4 h-4" />Create Invoice</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Invoice</DialogTitle><DialogDescription>Select an active student. The server resolves the authoritative consumer number from the student record.</DialogDescription></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2"><Label>Student</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={createForm.studentId} onChange={(event) => setCreateForm({ ...createForm, studentId: event.target.value })}>
                  <option value="">Select student</option>
                  {students.map((student) => <option key={student.id} value={student.id}>{student.name} — {student.consumerNumber}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Amount (PKR)</Label><Input type="number" min="0.01" step="0.01" value={createForm.amount} onChange={(event) => setCreateForm({ ...createForm, amount: event.target.value })} /></div>
                <div className="space-y-2"><Label>Billing Month</Label><Input type="month" value={createForm.month} onChange={(event) => setCreateForm({ ...createForm, month: event.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={createForm.dueDate} onChange={(event) => setCreateForm({ ...createForm, dueDate: event.target.value })} /></div>
              <Button className="w-full" onClick={() => void handleCreateInvoice()} disabled={creating}>{creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create Invoice</Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={genDialogOpen} onOpenChange={setGenDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><RefreshCw className="w-4 h-4" />Generate Invoices</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Generate Monthly Invoices</DialogTitle><DialogDescription>Create invoices from active student fee-plan assignments for the selected month.</DialogDescription></DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">Creates one invoice per active tuition-plan assignment and skips existing student, plan, and month combinations.</p>
              <div className="space-y-2">
                <Label htmlFor="gen-month">Month</Label>
                <Input id="gen-month" type="month" value={genMonth} onChange={(event) => setGenMonth(event.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setGenDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleGenerateInvoices} disabled={generating || !genMonth}>
                  {generating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Generate
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <FilterBar
        searchPlaceholder="Search by student, invoice #, or consumer #..."
        onSearch={(value) => { setSearch(value); setPage(1); }}
        filters={[
          { key: 'status', label: 'Status', options: [
            { value: 'pending', label: 'Pending' },
            { value: 'paid', label: 'Paid' },
            { value: 'overdue', label: 'Overdue' },
          ] },
          { key: 'class', label: 'Class', options: classOptions.map((className) => ({ value: className, label: className })) },
        ]}
        onFilterChange={(key, value) => {
          if (key === 'status') setStatusFilter(value);
          if (key === 'class') setClassFilter(value);
          setPage(1);
        }}
      />

      <div className="table-container">
        {invoices.length === 0 ? (
          <EmptyState icon={Receipt} title="No invoices found" description="No invoices match the current search or filters." />
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Invoice</TableHead><TableHead>Student</TableHead><TableHead>Class</TableHead>
              <TableHead>Consumer #</TableHead><TableHead>Month</TableHead><TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead><TableHead>Due date</TableHead><TableHead>Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-xs">{invoice.invoiceNumber}</TableCell>
                  <TableCell className="font-medium text-sm">{invoice.studentName}</TableCell>
                  <TableCell><span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md">{invoice.className || '-'} {invoice.section || ''}</span></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{invoice.consumerNumber}</TableCell>
                  <TableCell className="text-sm">{invoice.month}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatPKR(invoice.amount)}</TableCell>
                  <TableCell><StatusBadge status={invoice.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{invoice.dueDate}</TableCell>
                  <TableCell>
                    {invoice.status !== 'paid' && <button type="button" title="Delete invoice" disabled={deletingId === invoice.id} onClick={() => handleDeleteInvoice(invoice.id, invoice.invoiceNumber)} className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50">{deletingId === invoice.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <TablePagination total={total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
      </div>
    </div>
  );
};

export default InvoiceList;
