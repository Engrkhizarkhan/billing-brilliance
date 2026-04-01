import { useEffect, useState } from 'react';
import { Biller } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Eye, Pencil, PauseCircle, Ban, RefreshCcw } from 'lucide-react';
import { mockApi } from '@/lib/mockApi';

const BillerManagement = () => {
  const [billerList, setBillerList] = useState<Biller[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'school' as Biller['type'], email: '', phone: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const response = await mockApi.fetchBillers({});
      setBillerList(response.data);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = billerList.filter((b) => {
    const matchSearch = b.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    const matchType = typeFilter === 'all' || b.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.phone) {
      toast.error('Name, email, and phone are required');
      return;
    }
    setLoading(true);
    const response = await mockApi.createBiller({ name: form.name, email: form.email, phone: form.phone, type: form.type });
    setBillerList((prev) => [...prev, response.data]);
    setDialogOpen(false);
    setForm({ name: '', type: 'school', email: '', phone: '' });
    toast.success(`Biller "${response.data.name}" created with code ${response.data.billerCode}`);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: Biller['status']) => {
    setLoading(true);
    const updated = await mockApi.updateBillerStatus(id, status);
    if (updated.data) {
      setBillerList((prev) => prev.map((b) => (b.id === id ? updated.data : b)));
      toast.success(`Biller status updated to ${status}`);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Biller Management</h1>
          <p className="page-description">Manage billers and organizations. New schools get auto-generated biller codes.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={loading}><Plus className="w-4 h-4 mr-2" />Create New Biller</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create New Biller</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Organization Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Biller['type'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="school">School</SelectItem>
                    <SelectItem value="eta">ETA</SelectItem>
                    <SelectItem value="private_agency">Private Agency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <Button onClick={handleCreate} className="w-full" disabled={loading}>Create Biller</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <FilterBar
        searchPlaceholder="Search billers..."
        onSearch={setSearch}
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'banned', label: 'Banned' },
            ],
          },
          {
            key: 'type',
            label: 'Type',
            options: [
              { value: 'school', label: 'School' },
              { value: 'eta', label: 'ETA' },
              { value: 'private_agency', label: 'Private Agency' },
            ],
          },
        ]}
        onFilterChange={(key, v) => {
          if (key === 'status') setStatusFilter(v);
          if (key === 'type') setTypeFilter(v);
        }}
      />

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <RefreshCcw className="w-3.5 h-3.5" /> Data is session-only mock. Codes auto-increment and statuses persist in-memory.
      </div>

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Biller Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell className="capitalize">{b.type.replace('_', ' ')}</TableCell>
                <TableCell className="font-mono">{b.billerCode}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{b.email}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{b.phone}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{b.createdAt}</TableCell>
                <TableCell><StatusBadge status={b.status} /></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm"><Pencil className="w-4 h-4" /></Button>
                    {b.status !== 'suspended' && (
                      <Button variant="ghost" size="sm" onClick={() => updateStatus(b.id, 'suspended')}>
                        <PauseCircle className="w-4 h-4" />
                      </Button>
                    )}
                    {b.status !== 'banned' && (
                      <Button variant="ghost" size="sm" onClick={() => updateStatus(b.id, 'banned')}>
                        <Ban className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                    {b.status !== 'active' && (
                      <Button variant="ghost" size="sm" onClick={() => updateStatus(b.id, 'active')}>
                        <RefreshCcw className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default BillerManagement;
