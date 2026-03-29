import { useState } from 'react';
import { scholarships as initialScholarships } from '@/data/mockData';
import { Scholarship } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Power, RotateCcw } from 'lucide-react';

const Scholarships = () => {
  const [list, setList] = useState<Scholarship[]>(initialScholarships);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'percentage' as Scholarship['type'], value: '', startDate: '', endDate: '', isLifetime: false });

  const handleCreate = () => {
    if (!form.name || !form.value || !form.startDate || (!form.isLifetime && !form.endDate)) {
      toast.error('Please complete all required scholarship fields');
      return;
    }

    const s: Scholarship = {
      id: `sch${list.length + 1}`,
      name: form.name,
      type: form.type,
      value: Number(form.value),
      startDate: form.startDate,
      endDate: form.isLifetime ? null : form.endDate,
      isLifetime: form.isLifetime,
      status: 'active',
    };
    setList([...list, s]);
    setDialogOpen(false);
    setForm({ name: '', type: 'percentage', value: '', startDate: '', endDate: '', isLifetime: false });
    toast.success(`Scholarship "${form.name}" created. Discount will be applied to invoices.`);
  };

  const deactivateScholarship = (id: string) => {
    setList((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      return {
        ...s,
        status: 'inactive',
        endDate: s.isLifetime ? null : (s.endDate || new Date().toISOString().split('T')[0]),
      };
    }));
    toast.success('Scholarship deactivated');
  };

  const reactivateScholarship = (id: string) => {
    setList((prev) => prev.map((s) => s.id === id ? { ...s, status: 'active' } : s));
    toast.success('Scholarship reactivated');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Scholarships</h1>
          <p className="page-description">Manage discounts and financial aid</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Create Scholarship</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Scholarship</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Scholarship['type'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Value {form.type === 'percentage' ? '(%)' : '(₨)'}</Label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
              <div><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
              <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                <Checkbox
                  id="lifetime-scholarship"
                  checked={form.isLifetime}
                  onCheckedChange={(checked) => setForm({ ...form, isLifetime: checked === true, endDate: checked === true ? '' : form.endDate })}
                />
                <Label htmlFor="lifetime-scholarship" className="text-sm">Lifetime scholarship (expires only on deactivation)</Label>
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  disabled={form.isLifetime}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
              <Button onClick={handleCreate} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="capitalize">{s.type}</TableCell>
                <TableCell>{s.type === 'percentage' ? `${s.value}%` : `₨ ${s.value.toLocaleString()}`}</TableCell>
                <TableCell className="text-sm">{s.isLifetime ? 'Lifetime (until deactivated)' : `${s.startDate} → ${s.endDate || '—'}`}</TableCell>
                <TableCell><StatusBadge status={s.status} /></TableCell>
                <TableCell>
                  {s.status === 'active' ? (
                    <Button variant="outline" size="sm" className="h-8" onClick={() => deactivateScholarship(s.id)}>
                      <Power className="w-3.5 h-3.5 mr-1.5" />Deactivate
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-8" onClick={() => reactivateScholarship(s.id)}>
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reactivate
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Scholarships;
