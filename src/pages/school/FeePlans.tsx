import { useState } from 'react';
import { feePlans as initialPlans } from '@/data/mockData';
import { FeePlan } from '@/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const FeePlans = () => {
  const [plans, setPlans] = useState<FeePlan[]>(initialPlans);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', amount: '', frequency: 'monthly' as FeePlan['frequency'], dueDay: '10', lateFee: '' });

  const handleCreate = () => {
    const newPlan: FeePlan = {
      id: `fp${plans.length + 1}`,
      name: form.name,
      amount: Number(form.amount),
      frequency: form.frequency,
      dueDay: Number(form.dueDay),
      lateFee: Number(form.lateFee),
    };
    setPlans([...plans, newPlan]);
    setDialogOpen(false);
    toast.success('Fee plan created. Monthly invoices will be generated.');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Fee Plans</h1>
          <p className="page-description">Manage recurring billing plans</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Create Plan</Button></DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Create Fee Plan</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Plan Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Fee Amount (₨)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                <div>
                  <Label>Frequency</Label>
                  <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v as FeePlan['frequency'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Due Day</Label><Input type="number" value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })} /></div>
                <div><Label>Late Fee (₨)</Label><Input type="number" value={form.lateFee} onChange={(e) => setForm({ ...form, lateFee: e.target.value })} /></div>
              </div>
              <Button onClick={handleCreate} className="w-full">Create Plan</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan Name</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Due Day</TableHead>
              <TableHead>Late Fee</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>₨ {p.amount.toLocaleString()}</TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{p.frequency}</Badge></TableCell>
                <TableCell>{p.dueDay}th</TableCell>
                <TableCell>₨ {p.lateFee.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default FeePlans;
