import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatPKR } from '@/lib/formatters';
import { CheckCircle2, Loader2, Receipt } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  targetType: 'invoice' | 'org_payment';
  targetId: string;
  consumerNumber: string;
  payerLabel: string;
  amount: number;
  onSuccess: () => void | Promise<void>;
};

export const RecordPaymentDialog = ({ targetType, targetId, consumerNumber, payerLabel, amount, onSuccess }: Props) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ receiptNumber: string } | null>(null);
  const [form, setForm] = useState({
    receivedAt: new Date().toISOString().slice(0, 16), channel: 'counter',
    externalReference: '', reason: '', confirmation: '',
  });
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const submit = async () => {
    if (form.confirmation !== consumerNumber) return toast.error('Consumer number confirmation does not match');
    if (!form.externalReference.trim() || form.reason.trim().length < 5) return toast.error('Reference and a meaningful reason are required');
    setSaving(true);
    try {
      const response = await api.recordManualPayment({
        targetType, invoiceId: targetType === 'invoice' ? targetId : undefined,
        orgPaymentId: targetType === 'org_payment' ? targetId : undefined,
        consumerNumber, amount, receivedAt: new Date(form.receivedAt).toISOString(),
        channel: form.channel, externalReference: form.externalReference.trim(),
        reason: form.reason.trim(), idempotencyKey,
      });
      setResult(response.data);
      toast.success(`Payment recorded — receipt ${response.data.receiptNumber}`);
      await onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to record payment');
    } finally { setSaving(false); }
  };

  const reset = () => {
    setResult(null);
    setIdempotencyKey(crypto.randomUUID());
    setForm({ receivedAt: new Date().toISOString().slice(0, 16), channel: 'counter', externalReference: '', reason: '', confirmation: '' });
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) reset(); }}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Receipt className="w-3.5 h-3.5 mr-1.5" />Record payment</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Record a verified payment</DialogTitle><DialogDescription>Post the exact amount only after independently confirming receipt of funds.</DialogDescription></DialogHeader>
        {result ? (
          <div className="space-y-4 text-center py-4"><CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" /><div><p className="font-semibold">Payment posted</p><p className="font-mono text-sm mt-1">{result.receiptNumber}</p></div><Button onClick={() => setOpen(false)}>Done</Button></div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-3 text-sm"><p className="font-medium">{payerLabel}</p><p className="font-mono text-xs mt-1">{consumerNumber}</p><p className="font-semibold mt-2">Exact amount: {formatPKR(amount)}</p></div>
            <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Received at</Label><Input type="datetime-local" value={form.receivedAt} onChange={(event) => setForm({ ...form, receivedAt: event.target.value })} /></div><div className="space-y-2"><Label>Channel</Label><Select value={form.channel} onValueChange={(channel) => setForm({ ...form, channel })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="counter">Counter</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank_transfer">Bank transfer</SelectItem><SelectItem value="cheque">Cheque</SelectItem><SelectItem value="adjustment">Adjustment</SelectItem></SelectContent></Select></div></div>
            <div className="space-y-2"><Label>Receipt / bank reference</Label><Input value={form.externalReference} onChange={(event) => setForm({ ...form, externalReference: event.target.value })} placeholder="Unique reference" /></div>
            <div className="space-y-2"><Label>Reason / evidence note</Label><Input value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Why this payment is being recorded manually" /></div>
            <div className="space-y-2"><Label>Type consumer number to confirm</Label><Input className="font-mono" value={form.confirmation} onChange={(event) => setForm({ ...form, confirmation: event.target.value })} /></div>
            <p className="text-xs text-muted-foreground">This creates an immutable payment, transaction, allocation, ledger entry and audit record. Corrections require a reversal; the payment is never silently deleted.</p>
            <Button className="w-full" disabled={saving || form.confirmation !== consumerNumber} onClick={() => void submit()}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Post exact payment</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
