import { useEffect, useState } from 'react';
import { OrgPosting } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { ExportButton } from '@/components/ExportButton';
import { EmptyState } from '@/components/EmptyState';
import { TablePagination } from '@/components/TablePagination';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Megaphone, Users, Calendar, MoreHorizontal, Eye, Copy, Loader2 } from 'lucide-react';
import { formatPKR } from '@/lib/formatters';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { notifyPaymentUpdate } from '@/store/paymentStore';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';

const initialForm = {
  title: '',
  type: 'entry_test' as 'entry_test' | 'job_vacancy',
  department: '',
  totalSeats: '',
  applicationFee: '',
  startDate: '',
  endDate: '',
  testDate: '',
};

const toFormValues = (posting: OrgPosting) => ({
  title: posting.title,
  type: posting.type,
  department: posting.department,
  totalSeats: String(posting.totalSeats),
  applicationFee: String(posting.applicationFee),
  startDate: posting.startDate,
  endDate: posting.endDate,
  testDate: posting.testDate,
});

const ETEAPostings = () => {
  const { data: postingsData, loading, refetch } = useApiQuery(() => api.fetchPostings(), []);
  const [postings, setPostings] = useState<OrgPosting[]>([]);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedPosting, setSelectedPosting] = useState<OrgPosting | null>(null);
  const [editingPostingId, setEditingPostingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (postingsData) setPostings(postingsData as OrgPosting[]);
  }, [postingsData]);

  const filtered = postings.filter(p => p.title.toLowerCase().includes(search.toLowerCase()) || p.department.toLowerCase().includes(search.toLowerCase()));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleOpenCreate = () => {
    setEditingPostingId(null);
    setForm(initialForm);
    setAddOpen(true);
  };

  const handleAddOrUpdate = async () => {
    if (!form.title.trim()) {
      toast.error('Posting title is required');
      return;
    }

    try {
      if (editingPostingId) {
        await api.updatePosting(editingPostingId, {
          title: form.title.trim(),
          type: form.type,
          department: form.department.trim(),
          totalSeats: Number.parseInt(form.totalSeats, 10) || 0,
          applicationFee: Number.parseInt(form.applicationFee, 10) || 0,
          startDate: form.startDate,
          endDate: form.endDate,
          testDate: form.testDate,
        });
        toast.success(`Posting "${form.title.trim()}" updated`);
      } else {
        await api.createPosting({
          title: form.title.trim(),
          type: form.type,
          department: form.department.trim(),
          totalSeats: Number.parseInt(form.totalSeats, 10) || 0,
          applicationFee: Number.parseInt(form.applicationFee, 10) || 0,
          startDate: form.startDate,
          endDate: form.endDate,
          testDate: form.testDate,
          status: 'draft',
          applicationsReceived: 0,
        });
        toast.success(`Posting "${form.title.trim()}" created as draft`);
      }

      await refetch();
      notifyPaymentUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save posting');
    }

    setAddOpen(false);
    setEditingPostingId(null);
    setForm(initialForm);
  };

  const handleView = (posting: OrgPosting) => {
    setSelectedPosting(posting);
    setViewOpen(true);
  };

  const handleEdit = (posting: OrgPosting) => {
    setEditingPostingId(posting.id);
    setForm(toFormValues(posting));
    setAddOpen(true);
  };

  const handleClone = async (posting: OrgPosting) => {
    try {
      await api.createPosting({
        ...posting,
        id: undefined,
        title: `${posting.title} (Copy)`,
        status: 'draft',
        applicationsReceived: 0,
      });
      await refetch();
      notifyPaymentUpdate();
      setPage(1);
      toast.success(`Posting cloned as "${posting.title} (Copy)"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clone posting');
    }
  };

  if (loading && postings.length === 0) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="page-header">Test / Job Postings</h1><p className="page-description">Manage entry tests and job vacancy postings</p></div>
        <div className="flex gap-2">
          <ExportButton data={filtered.map(p => ({ Title: p.title, Type: p.type, Department: p.department, Seats: p.totalSeats, Fee: p.applicationFee, Status: p.status, Applications: p.applicationsReceived }))} filename="postings" />
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild><Button size="sm" className="rounded-lg" onClick={handleOpenCreate}><Plus className="w-4 h-4 mr-1.5" />Add Posting</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editingPostingId ? 'Edit Posting' : 'Create New Posting'}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2"><Label className="text-xs font-semibold">Title *</Label><Input className="h-10 rounded-xl" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="MDCAT 2025" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Type</Label>
                    <Select value={form.type} onValueChange={(v: 'entry_test' | 'job_vacancy') => setForm({ ...form, type: v })}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="entry_test">Entry Test</SelectItem><SelectItem value="job_vacancy">Job Vacancy</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label className="text-xs font-semibold">Department</Label><Input className="h-10 rounded-xl" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="Medical / Education Dept" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label className="text-xs font-semibold">Total Seats</Label><Input type="number" className="h-10 rounded-xl" value={form.totalSeats} onChange={e => setForm({ ...form, totalSeats: e.target.value })} /></div>
                  <div className="space-y-2"><Label className="text-xs font-semibold">Application Fee (PKR)</Label><Input type="number" className="h-10 rounded-xl" value={form.applicationFee} onChange={e => setForm({ ...form, applicationFee: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2"><Label className="text-xs font-semibold">Start Date</Label><Input type="date" className="h-10 rounded-xl" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
                  <div className="space-y-2"><Label className="text-xs font-semibold">End Date</Label><Input type="date" className="h-10 rounded-xl" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
                  <div className="space-y-2"><Label className="text-xs font-semibold">Test Date</Label><Input type="date" className="h-10 rounded-xl" value={form.testDate} onChange={e => setForm({ ...form, testDate: e.target.value })} /></div>
                </div>
                <Button onClick={handleAddOrUpdate} className="w-full h-10 rounded-xl" disabled={!form.title.trim()}>{editingPostingId ? 'Save Changes' : 'Create Posting'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <FilterBar searchPlaceholder="Search postings…" onSearch={v => { setSearch(v); setPage(1); }} />
      <div className="table-container">
        {paginated.length === 0 ? (
          <EmptyState icon={Megaphone} title="No postings yet" description="Create your first test or job posting to start accepting applications." actionLabel="+ Create First Posting" onAction={handleOpenCreate} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Title</TableHead>
                <TableHead className="text-xs font-semibold">Type</TableHead>
                <TableHead className="text-xs font-semibold">Department</TableHead>
                <TableHead className="text-xs font-semibold">Seats</TableHead>
                <TableHead className="text-xs font-semibold">Fee</TableHead>
                <TableHead className="text-xs font-semibold">Applications</TableHead>
                <TableHead className="text-xs font-semibold">Test Date</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map(p => (
                <TableRow key={p.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-sm">{p.title}</TableCell>
                  <TableCell><span className="text-xs capitalize bg-muted px-2 py-0.5 rounded-md">{p.type.replace('_', ' ')}</span></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.department}</TableCell>
                  <TableCell className="font-mono text-sm">{p.totalSeats.toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-sm">{formatPKR(p.applicationFee)}</TableCell>
                  <TableCell className="font-mono text-sm font-semibold">{p.applicationsReceived.toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.testDate}</TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => handleView(p)}><Eye className="w-4 h-4 mr-2" />View</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleEdit(p)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleClone(p)}><Copy className="w-4 h-4 mr-2" />Clone</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <TablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Posting Details</DialogTitle></DialogHeader>
          {selectedPosting ? (
            <div className="space-y-4 pt-2">
              <div>
                <p className="text-sm font-semibold">{selectedPosting.title}</p>
                <p className="text-xs text-muted-foreground">{selectedPosting.department}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{selectedPosting.type.replace('_', ' ')}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="mt-1"><StatusBadge status={selectedPosting.status} /></div>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Application Fee</p>
                  <p className="font-medium">{formatPKR(selectedPosting.applicationFee)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Total Seats</p>
                  <p className="font-medium">{selectedPosting.totalSeats.toLocaleString()}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Users className="w-4 h-4" /><span>Applications: {selectedPosting.applicationsReceived.toLocaleString()}</span></div>
                <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="w-4 h-4" /><span>Test Date: {selectedPosting.testDate || 'TBD'}</span></div>
              </div>
              <Button
                variant="outline"
                className="w-full rounded-lg"
                onClick={() => {
                  setViewOpen(false);
                  handleEdit(selectedPosting);
                }}
              >
                Edit This Posting
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ETEAPostings;
