import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { FeePlan } from '@/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Loader2, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const emptyForm = { name: '', amount: '', frequency: 'monthly' as FeePlan['frequency'], dueDay: '10', lateFee: '' };

const FeePlans = () => {
  const { data: plansData, loading, refetch } = useApiQuery(() => api.fetchFeePlans(), []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<FeePlan | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const plans = (plansData || []) as FeePlan[];

  useEffect(() => {}, []);

  const openCreate = () => {
    setEditingPlan(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (plan: FeePlan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      amount: String(plan.amount),
      frequency: plan.frequency,
      dueDay: String(plan.dueDay),
      lateFee: String(plan.lateFee),
    });
    setDialogOpen(true);
  };

  if (loading && plans.length === 0) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const handleSave = async () => {
    if (!form.name || !form.amount || !form.lateFee) {
      toast.error('Please complete all fee plan fields');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        amount: Number(form.amount),
        frequency: form.frequency,
        dueDay: Number(form.dueDay),
        lateFee: Number(form.lateFee),
      };
      if (editingPlan) {
        await api.updateFeePlan(editingPlan.id, payload);
        toast.success('Fee plan updated.');
      } else {
        await api.createFeePlan(payload);
        toast.success('Fee plan created and stored in the live backend.');
      }
      await refetch();
      setDialogOpen(false);
      setForm(emptyForm);
      setEditingPlan(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save fee plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (plan: FeePlan) => {
    if (!window.confirm(`Delete fee plan "${plan.name}"? This cannot be undone.`)) return;
    setDeletingId(plan.id);
    try {
      await api.deleteFeePlan(plan.id);
      await refetch();
      toast.success(`Fee plan "${plan.name}" deleted.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete fee plan');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Fee Plans</h1>
          <p className="page-description">Manage recurring billing plans</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingPlan(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild><Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Create Plan</Button></DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>{editingPlan ? 'Edit Fee Plan' : 'Create Fee Plan'}</DialogTitle></DialogHeader>
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
              <Button onClick={() => void handleSave()} className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingPlan ? 'Save Changes' : 'Create Plan'}
              </Button>
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
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>₨ {Number(p.amount).toLocaleString()}</TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{p.frequency}</Badge></TableCell>
                <TableCell>{p.dueDay}th</TableCell>
                <TableCell>₨ {Number(p.lateFee).toLocaleString()}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      disabled={deletingId === p.id}
                      onClick={() => void handleDelete(p)}
                    >
                      {deletingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
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

export default FeePlans;
