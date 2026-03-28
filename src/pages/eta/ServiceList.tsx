import { useState } from 'react';
import { services as initialServices } from '@/data/mockData';
import { Service } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

const ServiceList = () => {
  const [list, setList] = useState<Service[]>(initialServices);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', paymentType: 'one-time' as Service['paymentType'], amount: '' });

  const handleCreate = () => {
    const s: Service = {
      id: `srv${list.length + 1}`,
      name: form.name,
      paymentType: form.paymentType,
      amount: Number(form.amount),
      status: 'active',
    };
    setList([...list, s]);
    setDialogOpen(false);
    setForm({ name: '', paymentType: 'one-time', amount: '' });
    toast.success(`Service "${form.name}" created`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Services</h1>
          <p className="page-description">Manage offered services</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Create Service</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Service</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Service Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <Label>Payment Type</Label>
                <Select value={form.paymentType} onValueChange={(v) => setForm({ ...form, paymentType: v as Service['paymentType'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one-time">One-time</SelectItem>
                    <SelectItem value="multiple">Multiple (Installments)</SelectItem>
                    <SelectItem value="recurring">Recurring</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Amount (₨)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              {form.paymentType === 'multiple' && (
                <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                  <p className="font-medium">Installment Preview:</p>
                  <p>Installment 1: ₨ {Math.ceil(Number(form.amount || 0) / 3).toLocaleString()}</p>
                  <p>Installment 2: ₨ {Math.ceil(Number(form.amount || 0) / 3).toLocaleString()}</p>
                  <p>Installment 3: ₨ {(Number(form.amount || 0) - Math.ceil(Number(form.amount || 0) / 3) * 2).toLocaleString()}</p>
                </div>
              )}
              {form.paymentType === 'recurring' && (
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <p className="font-medium">Monthly invoices will be generated automatically.</p>
                </div>
              )}
              <Button onClick={handleCreate} className="w-full">Create Service</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service Name</TableHead>
              <TableHead>Payment Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{s.paymentType}</Badge></TableCell>
                <TableCell>₨ {s.amount.toLocaleString()}</TableCell>
                <TableCell><StatusBadge status={s.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ServiceList;
