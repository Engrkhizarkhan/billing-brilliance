import { useState } from 'react';
import { billers as initialBillers } from '@/data/mockData';
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
import { Plus, Eye, Pencil, PauseCircle, Ban } from 'lucide-react';

const BillerManagement = () => {
  const [billerList, setBillerList] = useState<Biller[]>(initialBillers);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'school' as Biller['type'], email: '', phone: '' });

  const filtered = billerList.filter((b) => {
    const matchSearch = b.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleCreate = () => {
    const code = String(1000 + billerList.length + 1);
    const newBiller: Biller = {
      id: String(billerList.length + 1),
      name: form.name,
      type: form.type,
      billerCode: code,
      email: form.email,
      phone: form.phone,
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setBillerList([...billerList, newBiller]);
    setDialogOpen(false);
    setForm({ name: '', type: 'school', email: '', phone: '' });
    toast.success(`Biller "${form.name}" created with code ${code}`);
  };

  const updateStatus = (id: string, status: Biller['status']) => {
    setBillerList(billerList.map((b) => (b.id === id ? { ...b, status } : b)));
    toast.success(`Biller status updated to ${status}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Biller Management</h1>
          <p className="page-description">Manage billers and organizations</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Create New Biller</Button>
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
              <Button onClick={handleCreate} className="w-full">Create Biller</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <FilterBar
        searchPlaceholder="Search billers..."
        onSearch={setSearch}
        filters={[{
          key: 'status',
          label: 'Status',
          options: [
            { value: 'active', label: 'Active' },
            { value: 'suspended', label: 'Suspended' },
            { value: 'banned', label: 'Banned' },
          ],
        }]}
        onFilterChange={(_, v) => setStatusFilter(v)}
      />

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Biller Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Code</TableHead>
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
