import { useState } from 'react';
import { applicants as initialApplicants, services, eteaPostings, generateConsumerNumber } from '@/data/mockData';
import { Applicant } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { ExportButton } from '@/components/ExportButton';
import { TablePagination } from '@/components/TablePagination';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, UserPlus, Upload, FileText, Download, Eye, MoreHorizontal } from 'lucide-react';
import { formatCNIC, formatPhone, formatPKR } from '@/lib/formatters';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const kpkDistricts = ['Peshawar', 'Mardan', 'Swabi', 'Nowshera', 'Charsadda', 'Abbottabad', 'Mansehra', 'Haripur', 'Swat', 'Dir Lower', 'Dir Upper', 'Kohat', 'Bannu', 'D.I. Khan'];

const statusLabels: Record<string, string> = {
  submitted: 'Submitted',
  fee_pending: 'Fee Pending',
  fee_paid: 'Fee Paid',
  roll_assigned: 'Roll Assigned',
  test_scheduled: 'Test Scheduled',
  appeared: 'Appeared',
  result_pending: 'Result Pending',
  selected: 'Selected',
  rejected: 'Rejected',
};

const statusColors: Record<string, string> = {
  submitted: 'bg-muted text-muted-foreground',
  fee_pending: 'bg-warning/10 text-warning',
  fee_paid: 'bg-success/10 text-success',
  roll_assigned: 'bg-primary/10 text-primary',
  test_scheduled: 'bg-info/10 text-info',
  appeared: 'bg-primary/10 text-primary',
  result_pending: 'bg-warning/10 text-warning',
  selected: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
};

const ApplicantList = () => {
  const [applicantList, setApplicantList] = useState<Applicant[]>(initialApplicants);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [postingFilter, setPostingFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [form, setForm] = useState({
    name: '', fatherName: '', cnic: '', phone: '', email: '', district: 'Peshawar',
    gender: 'male' as 'male' | 'female', dateOfBirth: '', qualification: 'FSc Pre-Medical', serviceId: 'srv1',
  });

  const filtered = applicantList.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) || a.cnic.includes(search) || (a.rollNumber || '').includes(search);
    const matchStatus = statusFilter === 'all' || a.applicationStatus === statusFilter;
    const matchPosting = postingFilter === 'all' || a.serviceId === postingFilter;
    return matchSearch && matchStatus && matchPosting;
  });

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleAdd = () => {
    // Check duplicate CNIC
    const existing = applicantList.find(a => a.cnic === form.cnic && a.serviceId === form.serviceId);
    if (existing) {
      toast.error(`Already applied. Existing application ID: ${existing.billId}`);
      return;
    }
    const idx = applicantList.length + 1;
    const newApplicant: Applicant = {
      id: `a${idx}`,
      name: form.name,
      fatherName: form.fatherName,
      cnic: form.cnic,
      phone: form.phone,
      email: form.email,
      district: form.district,
      gender: form.gender,
      dateOfBirth: form.dateOfBirth,
      qualification: form.qualification,
      consumerNumber: generateConsumerNumber('2001', String(idx)),
      billId: `ETA-MDCAT25-${String(idx).padStart(5, '0')}`,
      paymentStatus: 'pending',
      applicationStatus: 'submitted',
      serviceId: form.serviceId,
      appliedDate: new Date().toISOString().split('T')[0],
    };
    setApplicantList([...applicantList, newApplicant]);
    setAddOpen(false);
    setForm({ name: '', fatherName: '', cnic: '', phone: '', email: '', district: 'Peshawar', gender: 'male', dateOfBirth: '', qualification: 'FSc Pre-Medical', serviceId: 'srv1' });
    toast.success(`Applicant added — Bill ID: ${newApplicant.billId}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Applicants</h1>
          <p className="page-description">Track applicant registrations and payment status • {applicantList.length} total</p>
        </div>
        <div className="flex gap-2">
          <ExportButton data={filtered.map(a => ({ Name: a.name, Father: a.fatherName, CNIC: a.cnic, Phone: a.phone, District: a.district, Status: a.applicationStatus, Payment: a.paymentStatus }))} filename="applicants" />
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-lg"><Plus className="w-4 h-4 mr-1.5" />Add Applicant</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Add New Applicant</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label className="text-xs font-semibold">Full Name *</Label><Input className="h-10 rounded-xl" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tariq Mehmood" /></div>
                  <div className="space-y-2"><Label className="text-xs font-semibold">Father Name *</Label><Input className="h-10 rounded-xl" value={form.fatherName} onChange={(e) => setForm({ ...form, fatherName: e.target.value })} placeholder="Muhammad Mehmood" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label className="text-xs font-semibold">CNIC *</Label><Input className="h-10 rounded-xl font-mono" value={form.cnic} onChange={(e) => setForm({ ...form, cnic: formatCNIC(e.target.value) })} placeholder="15201-1234567-1" maxLength={15} /></div>
                  <div className="space-y-2"><Label className="text-xs font-semibold">Phone *</Label><Input className="h-10 rounded-xl font-mono" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} placeholder="0312-1234567" maxLength={12} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label className="text-xs font-semibold">Email</Label><Input type="email" className="h-10 rounded-xl" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="applicant@gmail.com" /></div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">District (Domicile) *</Label>
                    <Select value={form.district} onValueChange={(v) => setForm({ ...form, district: v })}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>{kpkDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Gender</Label>
                    <Select value={form.gender} onValueChange={(v: 'male' | 'female') => setForm({ ...form, gender: v })}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label className="text-xs font-semibold">Date of Birth</Label><Input type="date" className="h-10 rounded-xl" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Qualification *</Label>
                    <Select value={form.qualification} onValueChange={(v) => setForm({ ...form, qualification: v })}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['FSc Pre-Medical', 'FSc Pre-Engineering', 'BA/BSc', 'MA/MSc', 'BS 4-Year'].map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Applied Posting *</Label>
                    <Select value={form.serviceId} onValueChange={(v) => setForm({ ...form, serviceId: v })}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {services.filter(s => s.status === 'active').map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name} — {formatPKR(s.amount)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleAdd} className="w-full h-10 rounded-xl" disabled={!form.name || !form.fatherName || !form.cnic || !form.phone}>
                  Submit Application
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Status pipeline summary */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(statusLabels).map(([key, label]) => {
          const count = applicantList.filter(a => a.applicationStatus === key).length;
          return (
            <button key={key} onClick={() => { setStatusFilter(key === statusFilter ? 'all' : key); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                statusFilter === key ? statusColors[key] + ' border-current' : 'border-border text-muted-foreground hover:border-foreground/20'
              }`}>
              {label} <span className="ml-1 font-mono">{count}</span>
            </button>
          );
        })}
      </div>

      <FilterBar
        searchPlaceholder="Search by name, CNIC, or roll number…"
        onSearch={(v) => { setSearch(v); setPage(1); }}
        filters={[{
          key: 'posting', label: 'Filter by Posting',
          options: services.filter(s => s.status === 'active').map(s => ({ value: s.id, label: s.name }))
        }]}
        onFilterChange={(_, v) => { setPostingFilter(v === 'all' ? 'all' : v); setPage(1); }}
      />

      <div className="table-container">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-sm font-semibold">Applicants <span className="text-muted-foreground font-normal ml-2">({filtered.length})</span></p>
        </div>
        {paginated.length === 0 ? (
          <EmptyState icon={UserPlus} title="No applicants yet" description="Add your first applicant to get started with the application process." actionLabel="+ Add First Applicant" onAction={() => setAddOpen(true)} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Name</TableHead>
                <TableHead className="text-xs font-semibold">Father Name</TableHead>
                <TableHead className="text-xs font-semibold">CNIC</TableHead>
                <TableHead className="text-xs font-semibold">District</TableHead>
                <TableHead className="text-xs font-semibold">Posting</TableHead>
                <TableHead className="text-xs font-semibold">Payment</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold">Roll #</TableHead>
                <TableHead className="text-xs font-semibold w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((a) => (
                <TableRow key={a.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-sm">{a.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.fatherName}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{a.cnic}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.district}</TableCell>
                  <TableCell className="text-xs"><span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md">{services.find(s => s.id === a.serviceId)?.name || '—'}</span></TableCell>
                  <TableCell><StatusBadge status={a.paymentStatus} /></TableCell>
                  <TableCell><span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusColors[a.applicationStatus]}`}>{statusLabels[a.applicationStatus]}</span></TableCell>
                  <TableCell className="font-mono text-xs">{a.rollNumber || '—'}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Eye className="w-4 h-4 mr-2" />View Details</DropdownMenuItem>
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem>Download Admit Card</DropdownMenuItem>
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

export default ApplicantList;
