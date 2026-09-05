import { useDeferredValue, useState } from 'react';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import type { Invoice } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { TablePagination } from '@/components/TablePagination';
import { EmptyState } from '@/components/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Receipt, Loader2, RefreshCw, Trash2 } from 'lucide-react';
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
  const deferredSearch = useDeferredValue(search);

  const { data, meta, loading, refetch: refetchInvoices } = useApiQuery(
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

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Invoices</h1>
          <p className="page-description">Track and manage fee invoices · {total} matching invoices</p>
        </div>
        <Dialog open={genDialogOpen} onOpenChange={setGenDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><RefreshCw className="w-4 h-4" />Generate Invoices</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Generate Monthly Invoices</DialogTitle></DialogHeader>
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
              <TableHead>Status</TableHead><TableHead>Due date</TableHead><TableHead className="w-10" />
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
                    {invoice.status === 'pending' && (
                      <button type="button" title="Delete invoice" disabled={deletingId === invoice.id} onClick={() => handleDeleteInvoice(invoice.id, invoice.invoiceNumber)} className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50">
                        {deletingId === invoice.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    )}
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
