import { useState } from 'react';
import { eteaPostings } from '@/data/mockData';
import { ETEAPosting } from '@/types';
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
import { Plus, Megaphone, Users, Calendar, MoreHorizontal, Eye, Copy } from 'lucide-react';
import { formatPKR } from '@/lib/formatters';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const ETEAPostings = () => {
  const [postings, setPostings] = useState<ETEAPosting[]>(eteaPostings);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [form, setForm] = useState({
    title: '', type: 'entry_test' as 'entry_test' | 'job_vacancy', department: '', totalSeats: '', applicationFee: '',
    startDate: '', endDate: '', testDate: '',
  });

  const filtered = postings.filter(p => p.title.toLowerCase().includes(search.toLowerCase()) || p.department.toLowerCase().includes(search.toLowerCase()));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleAdd = () => {
    const newPosting: ETEAPosting = {
      id: `ep${postings.length + 1}`,
      title: form.title,
      type: form.type,
      department: form.department,
      totalSeats: parseInt(form.totalSeats) || 0,
      applicationFee: parseInt(form.applicationFee) || 0,
      startDate: form.startDate,
      endDate: form.endDate,
      testDate: form.testDate,
      status: 'draft',
      applicationsReceived: 0,
    };
    setPostings([...postings, newPosting]);
    setAddOpen(false);
    setForm({ title: '', type: 'entry_test', department: '', totalSeats: '', applicationFee: '', startDate: '', endDate: '', testDate: '' });
    toast.success(`Posting "${newPosting.title}" created as draft`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="page-header">Test / Job Postings</h1><p className="page-description">Manage entry tests and job vacancy postings</p></div>
        <div className="flex gap-2">
          <ExportButton data={filtered.map(p => ({ Title: p.title, Type: p.type, Department: p.department, Seats: p.totalSeats, Fee: p.applicationFee, Status: p.status, Applications: p.applicationsReceived }))} filename="postings" />
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild><Button size="sm" className="rounded-lg"><Plus className="w-4 h-4 mr-1.5" />Add Posting</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create New Posting</DialogTitle></DialogHeader>
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
                <Button onClick={handleAdd} className="w-full h-10 rounded-xl" disabled={!form.title}>Create Posting</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <FilterBar searchPlaceholder="Search postings…" onSearch={v => { setSearch(v); setPage(1); }} />
      <div className="table-container">
        {paginated.length === 0 ? (
          <EmptyState icon={Megaphone} title="No postings yet" description="Create your first test or job posting to start accepting applications." actionLabel="+ Create First Posting" onAction={() => setAddOpen(true)} />
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
                        <DropdownMenuItem><Eye className="w-4 h-4 mr-2" />View</DropdownMenuItem>
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem><Copy className="w-4 h-4 mr-2" />Clone</DropdownMenuItem>
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
    </div>
  );
};

export default ETEAPostings;
