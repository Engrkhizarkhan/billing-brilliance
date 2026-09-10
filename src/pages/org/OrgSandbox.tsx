import { useState } from 'react';
import { FlaskConical, Play, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/authStore';

const sandboxUrl = (import.meta.env.VITE_SANDBOX_BASE_URL as string | undefined)?.replace(/\/$/, '');

const OrgSandbox = () => {
  const lifecycle = useAuthStore((state) => state.user?.tenantLifecycleStage);
  const [apiKey, setApiKey] = useState('');
  const [name, setName] = useState('Demo Customer');
  const [amount, setAmount] = useState(2500);
  const [consumerNumber, setConsumerNumber] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const call = async (path: string, method: 'GET' | 'POST', body?: unknown) => {
    if (!sandboxUrl) throw new Error('The isolated sandbox hostname is not configured');
    if (!apiKey.trim()) throw new Error('Enter your sandbox API key');
    const response = await fetch(`${sandboxUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey.trim() },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Sandbox request failed (${response.status})`);
    setResult(payload);
    return payload as Record<string, unknown>;
  };

  const run = async (action: () => Promise<void>) => {
    setLoading(true);
    try { await action(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Sandbox request failed'); }
    finally { setLoading(false); }
  };

  if (lifecycle === 'live') {
    return <Card className="border-emerald-300/60"><CardHeader><ShieldCheck className="h-6 w-6 text-emerald-600" /><CardTitle>Sandbox closed</CardTitle><CardDescription>This biller is live. Its disposable sandbox data and test key were revoked during activation; production data was not copied from testing.</CardDescription></CardHeader></Card>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div><div className="mb-2 flex items-center gap-2"><FlaskConical className="h-5 w-5 text-primary" /><Badge variant="secondary">Isolated environment</Badge></div><h1 className="page-header">API Sandbox</h1><p className="page-description">Create disposable consumers and simulate the complete billing flow without touching production or 1LINK.</p></div>

      <Card className="border-emerald-300/60"><CardHeader><ShieldCheck className="h-6 w-6 text-emerald-600" /><CardTitle>Production isolation</CardTitle><CardDescription>This console calls a separate API runtime, MySQL database, and test-key namespace. The sandbox has no route to the production 1LINK VPN.</CardDescription></CardHeader><CardContent className="grid gap-3 text-sm md:grid-cols-3"><div className="rounded-lg border p-3"><p className="font-medium">Disposable data</p><p className="mt-1 text-muted-foreground">Demo consumers, invoices, and payments are deleted at activation.</p></div><div className="rounded-lg border p-3"><p className="font-medium">Test credentials</p><p className="mt-1 text-muted-foreground">A `fintap_test_…` key works only on this host.</p></div><div className="rounded-lg border p-3"><p className="font-medium">No real collection</p><p className="mt-1 text-muted-foreground">Simulation never reaches 1LINK or settlement.</p></div></CardContent></Card>

      {!sandboxUrl ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Sandbox deployment is not configured for this frontend. Set <code>VITE_SANDBOX_BASE_URL</code> to the separately deployed sandbox API hostname.</div> : (
        <>
          <Card><CardHeader><CardTitle className="text-base">Sandbox credential</CardTitle><CardDescription>Paste the test key supplied during onboarding. It is kept only in this page’s memory and is never stored in the browser.</CardDescription></CardHeader><CardContent className="space-y-2"><Label htmlFor="sandbox-key">X-API-Key</Label><Input id="sandbox-key" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="fintap_test_…" /></CardContent></Card>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card><CardHeader><CardTitle className="text-base">1. Create demo consumer + invoice</CardTitle><CardDescription><code>POST /api/saas/v1/register-consumer</code></CardDescription></CardHeader><CardContent className="space-y-3"><div><Label>Customer name</Label><Input value={name} onChange={(event) => setName(event.target.value)} /></div><div><Label>Invoice amount (PKR)</Label><Input type="number" min={1} value={amount} onChange={(event) => setAmount(Number(event.target.value) || 0)} /></div><Button disabled={loading} onClick={() => void run(async () => { const payload = await call('/api/saas/v1/register-consumer', 'POST', { name, fatherName: 'Sandbox Record', class: 'UAT', gender: 'male', externalRef: `UAT-${Date.now()}`, invoice: { amount, dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), description: 'Sandbox invoice' } }); setConsumerNumber(String(payload.consumerNumber || '')); toast.success('Demo consumer and invoice created'); })}><Play className="mr-2 h-4 w-4" />Create demo</Button></CardContent></Card>

            <Card><CardHeader><CardTitle className="text-base">2. Check payment status</CardTitle><CardDescription><code>POST /api/saas/v1/check-payment</code></CardDescription></CardHeader><CardContent className="space-y-3"><div><Label>Consumer number</Label><Input value={consumerNumber} onChange={(event) => setConsumerNumber(event.target.value.replace(/\D/g, '').slice(0, 24))} /></div><Button variant="outline" disabled={loading || !consumerNumber} onClick={() => void run(async () => { await call('/api/saas/v1/check-payment', 'POST', { consumerNumber }); })}><Play className="mr-2 h-4 w-4" />Check status</Button></CardContent></Card>

            <Card><CardHeader><CardTitle className="text-base">3. Simulate payment</CardTitle><CardDescription><code>POST /api/saas/v1/make-payment</code></CardDescription></CardHeader><CardContent className="space-y-3"><div><Label>Exact invoice amount (PKR)</Label><Input type="number" min={1} value={amount} onChange={(event) => setAmount(Number(event.target.value) || 0)} /></div><Button disabled={loading || !consumerNumber} onClick={() => void run(async () => { await call('/api/saas/v1/make-payment', 'POST', { consumerNumber, amount, reference: `SANDBOX-${Date.now()}`, channel: 'sandbox_simulator', note: 'Client UAT simulation' }); toast.success('Sandbox payment simulated'); })}><Play className="mr-2 h-4 w-4" />Simulate payment</Button></CardContent></Card>
          </div>

          <Card><CardHeader className="flex-row items-start justify-between gap-4"><div><CardTitle className="text-base">Latest sandbox response</CardTitle><CardDescription>Use this JSON to verify your request/response handling.</CardDescription></div><Button variant="ghost" size="sm" onClick={() => setResult(null)} disabled={!result}><Trash2 className="mr-2 h-4 w-4" />Clear</Button></CardHeader><CardContent><pre className="max-h-[420px] overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100">{result ? JSON.stringify(result, null, 2) : '// Run a sandbox request to see its response.'}</pre></CardContent></Card>
        </>
      )}
    </div>
  );
};

export default OrgSandbox;
