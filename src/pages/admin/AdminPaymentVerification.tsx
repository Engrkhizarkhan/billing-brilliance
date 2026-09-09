import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate, formatPKR } from '@/lib/formatters';
import type { AdminPaymentInquiry, ManualPaymentResult } from '@/types';
import { usePaymentStore } from '@/store/paymentStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle2, ClipboardCheck, Code2, Copy, Loader2, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const initialForm = () => ({
  receivedAt: new Date().toISOString().slice(0, 16),
  channel: 'counter',
  externalReference: '',
  reason: '',
  confirmation: '',
});

const AdminPaymentVerification = () => {
  const [consumerNumber, setConsumerNumber] = useState('');
  const [inquiry, setInquiry] = useState<AdminPaymentInquiry | null>(null);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState<ManualPaymentResult | null>(null);
  const [form, setForm] = useState(initialForm);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const lookup = async (event?: FormEvent) => {
    event?.preventDefault();
    const normalized = consumerNumber.replace(/\D/g, '').slice(0, 24);
    if (!normalized) return toast.error('Enter a consumer number');
    setConsumerNumber(normalized);
    setLoading(true);
    setInquiry(null);
    setResult(null);
    setForm(initialForm());
    setIdempotencyKey(crypto.randomUUID());
    try {
      const response = await api.inquireAdminPayment(normalized);
      setInquiry(response.data);
      if (!response.data.found) toast.error('Consumer number was not found');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to complete payment inquiry');
    } finally {
      setLoading(false);
    }
  };

  const postPayment = async (event: FormEvent) => {
    event.preventDefault();
    if (!inquiry?.found || !inquiry.payable || !inquiry.tenantId || !inquiry.targetType || !inquiry.amount) return;
    if (form.confirmation !== inquiry.consumerNumber) return toast.error('Consumer number confirmation does not match');
    if (!form.externalReference.trim()) return toast.error('Enter the receipt or bank reference');
    if (form.reason.trim().length < 5) return toast.error('Enter a meaningful verification reason');
    setPosting(true);
    try {
      const response = await api.recordManualPayment({
        tenantId: inquiry.tenantId,
        targetType: inquiry.targetType,
        orgPaymentId: inquiry.targetType === 'org_payment' ? inquiry.targetId : undefined,
        consumerNumber: inquiry.consumerNumber,
        amount: inquiry.amount,
        receivedAt: new Date(form.receivedAt).toISOString(),
        channel: form.channel,
        externalReference: form.externalReference.trim(),
        reason: form.reason.trim(),
        idempotencyKey,
      });
      setResult(response.data);
      usePaymentStore.getState().bump();
      const refreshed = await api.inquireAdminPayment(inquiry.consumerNumber);
      setInquiry(refreshed.data);
      toast.success(`Payment verified — receipt ${response.data.receiptNumber}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to post verified payment');
    } finally {
      setPosting(false);
    }
  };

  const copyJson = async () => {
    if (!inquiry) return;
    await navigator.clipboard.writeText(JSON.stringify(inquiry.oneBillResponse, null, 2));
    toast.success('1BILL response copied');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Verify Payment</h1>
        <p className="page-description">Look up a consumer exactly as 1BILL does, then record independently verified funds through the canonical accounting workflow.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Search className="h-5 w-5" />Consumer inquiry</CardTitle>
          <CardDescription>Enter the complete 14-, preserved 20-, or 24-digit consumer number. No payment is changed during inquiry.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => void lookup(event)}>
            <div className="flex-1 space-y-2">
              <Label htmlFor="admin-consumer-number">Consumer number</Label>
              <Input id="admin-consumer-number" inputMode="numeric" autoComplete="off" className="font-mono"
                value={consumerNumber} maxLength={24} placeholder="Enter consumer number"
                onChange={(event) => setConsumerNumber(event.target.value.replace(/\D/g, '').slice(0, 24))} />
            </div>
            <Button className="sm:self-end" type="submit" disabled={loading || consumerNumber.length === 0}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Verify consumer
            </Button>
          </form>
        </CardContent>
      </Card>

      {inquiry && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div><CardTitle className="flex items-center gap-2 text-lg"><ClipboardCheck className="h-5 w-5" />Consumer details</CardTitle><CardDescription>Human-readable verification card</CardDescription></div>
                <Badge variant={inquiry.payable ? 'default' : 'secondary'}>{inquiry.payable ? 'Payable' : inquiry.found ? 'Unavailable' : 'Not found'}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {!inquiry.found ? (
                <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertCircle className="h-5 w-5 shrink-0" /><span>{inquiry.reason}</span></div>
              ) : (
                <div className="space-y-4">
                  <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Payer</p><p className="text-lg font-semibold">{inquiry.payerName}</p><p className="font-mono text-sm text-muted-foreground">{inquiry.consumerNumber}</p></div>
                  <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
                    <div><dt className="text-muted-foreground">Biller</dt><dd className="font-medium">{inquiry.tenantName}</dd></div>
                    <div><dt className="text-muted-foreground">Biller code</dt><dd className="font-mono">{inquiry.billerCode}</dd></div>
                    <div><dt className="text-muted-foreground">Bill ID</dt><dd className="font-mono break-all">{inquiry.billId || '—'}</dd></div>
                    <div><dt className="text-muted-foreground">Invoice / application</dt><dd>{inquiry.invoiceNumber || inquiry.applicationId || '—'}</dd></div>
                    <div><dt className="text-muted-foreground">Due date</dt><dd>{inquiry.dueDate ? formatDate(inquiry.dueDate) : '—'}</dd></div>
                    <div><dt className="text-muted-foreground">Status</dt><dd className="capitalize">{inquiry.consumerStatus}</dd></div>
                    <div><dt className="text-muted-foreground">Base amount</dt><dd>{formatPKR(inquiry.baseAmount || 0)}</dd></div>
                    <div><dt className="text-muted-foreground">Late fee</dt><dd>{formatPKR(inquiry.lateFee || 0)}</dd></div>
                  </dl>
                  <div className="rounded-lg border bg-muted/30 p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Exact amount to record</p><p className="mt-1 text-2xl font-bold">{formatPKR(inquiry.amount || 0)}</p></div>
                  {!inquiry.payable && <div className="flex gap-2 rounded-lg border p-3 text-sm"><AlertCircle className="h-4 w-4 shrink-0 text-amber-600" /><span>{inquiry.reason}</span></div>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div><CardTitle className="flex items-center gap-2 text-lg"><Code2 className="h-5 w-5" />1BILL API response</CardTitle><CardDescription>The exact field names and fixed-width values returned to the gateway</CardDescription></div>
                <Button type="button" size="sm" variant="outline" onClick={() => void copyJson()}><Copy className="mr-2 h-3.5 w-3.5" />Copy</Button>
              </div>
            </CardHeader>
            <CardContent><pre className="max-h-[420px] overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">{JSON.stringify(inquiry.oneBillResponse, null, 2)}</pre></CardContent>
          </Card>
        </div>
      )}

      {inquiry?.found && inquiry.payable && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5" />Record verified funds</CardTitle><CardDescription>This does not toggle a status. It atomically creates the payment, transaction, allocation, ledger, receipt, notification, outbox event, and audit evidence.</CardDescription></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => void postPayment(event)}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="admin-received-at">Received at</Label><Input id="admin-received-at" type="datetime-local" required value={form.receivedAt} onChange={(event) => setForm({ ...form, receivedAt: event.target.value })} /></div>
                <div className="space-y-2"><Label>Payment channel</Label><Select value={form.channel} onValueChange={(channel) => setForm({ ...form, channel })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="counter">Counter</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank_transfer">Bank transfer</SelectItem><SelectItem value="cheque">Cheque</SelectItem><SelectItem value="adjustment">Adjustment</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="admin-payment-reference">Receipt / bank reference</Label><Input id="admin-payment-reference" required value={form.externalReference} onChange={(event) => setForm({ ...form, externalReference: event.target.value })} placeholder="Unique evidence reference" /></div>
                <div className="space-y-2"><Label htmlFor="admin-payment-reason">Verification reason</Label><Input id="admin-payment-reason" required minLength={5} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="How receipt of funds was verified" /></div>
              </div>
              <div className="space-y-2"><Label htmlFor="admin-payment-confirmation">Type the consumer number to confirm {formatPKR(inquiry.amount || 0)}</Label><Input id="admin-payment-confirmation" className="font-mono" autoComplete="off" value={form.confirmation} onChange={(event) => setForm({ ...form, confirmation: event.target.value.replace(/\D/g, '').slice(0, 24) })} /></div>
              <Button type="submit" disabled={posting || form.confirmation !== inquiry.consumerNumber || !form.externalReference.trim() || form.reason.trim().length < 5}>{posting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record exact payment</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {result && <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"><CheckCircle2 className="h-5 w-5" /><div><p className="font-semibold">Payment recorded and re-verified</p><p className="text-sm">Receipt <span className="font-mono">{result.receiptNumber}</span></p></div></div>}
    </div>
  );
};

export default AdminPaymentVerification;
