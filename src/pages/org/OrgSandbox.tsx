import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { FlaskConical, Copy, CheckCheck, Infinity as InfinityIcon } from 'lucide-react';
import { useOrgSecurityStore } from '@/store/orgSecurityStore';
import { usePaymentStore } from '@/store/paymentStore';
import {
  OrgCreatePaymentResponse,
  OrgPaymentStatusResponse,
  OrgHealthResponse,
  OrgPaymentRecord,
} from '@/types';
import { formatPKR } from '@/lib/formatters';

const codeBlock = (content: string, statusLabel?: React.ReactNode) => (
  <div className="rounded-lg border bg-slate-800 dark:bg-slate-800 overflow-hidden">
    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
      <span className="text-xs font-mono text-slate-300">Response</span>
      {statusLabel}
    </div>
    <pre className="text-xs font-mono text-slate-100 p-4 overflow-auto whitespace-pre-wrap leading-relaxed min-h-[100px] max-h-[400px]">
      {content}
    </pre>
  </div>
);

const OrgSandbox = () => {
  const apiKey = useOrgSecurityStore((state) => state.apiKey);

  // ── Create Payment ────────────────────────────────────────────────────────
  const [createForm, setCreateForm] = useState({
    applicant_id: 'SANDBOX-001',
    application_id: 'APP-SANDBOX-001',
    posting_id: 'TEST-POSTING',
    amount: 500,
    never_expires: false,
    expires_in_minutes: 0,
    description: 'Sandbox test payment',
    customer_name: 'Test Applicant',
  });
  const [createResult, setCreateResult] = useState<OrgCreatePaymentResponse | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  // ── Status Lookup ─────────────────────────────────────────────────────────
  const [lookupId, setLookupId] = useState('APP-SANDBOX-001');
  const [lookupResult, setLookupResult] = useState<OrgPaymentStatusResponse | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // ── All Payments ──────────────────────────────────────────────────────────
  const [allPayments, setAllPayments] = useState<OrgPaymentRecord[] | null>(null);
  const [allLoading, setAllLoading] = useState(false);

  // ── Health ────────────────────────────────────────────────────────────────
  const [health, setHealth] = useState<OrgHealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // ── Copy ──────────────────────────────────────────────────────────────────
  const [copied, setCopied] = useState<string | null>(null);
  const copyText = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleCreate = async () => {
    setCreateLoading(true);
    try {
      const res = await api.createOrgPayment({
        applicantId: createForm.applicant_id,
        applicationId: createForm.application_id,
        postingId: createForm.posting_id,
        amount: createForm.amount,
        neverExpires: createForm.never_expires,
        expireAt: (!createForm.never_expires && createForm.expires_in_minutes > 0)
          ? new Date(Date.now() + createForm.expires_in_minutes * 60 * 1000).toISOString()
          : undefined,
        description: createForm.description || undefined,
        customerName: createForm.customer_name || createForm.applicant_id,
      });
      const created = res.data as OrgCreatePaymentResponse;
      setCreateResult(created);
      setLookupId(created.payment.applicationId);
      usePaymentStore.getState().bump();
      toast.success(`[Sandbox] Payment request created · ${created.paymentId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Sandbox create failed');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleLookup = async () => {
    if (!lookupId.trim()) { toast.error('application_id required'); return; }
    setLookupLoading(true);
    try {
      const res = await api.getOrgPaymentStatus(lookupId.trim());
      setLookupResult(res.data as OrgPaymentStatusResponse);
      toast.success('[Sandbox] Status fetched');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Status lookup failed');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleFetchAll = async () => {
    setAllLoading(true);
    try {
      const res = await api.listOrgPayments();
      setAllPayments((res.data as OrgPaymentRecord[]) ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fetch failed');
    } finally {
      setAllLoading(false);
    }
  };

  const handleHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await api.orgHealthCheck();
      setHealth(res.data as OrgHealthResponse);
      toast.success('[Sandbox] Health check passed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Health check failed');
    } finally {
      setHealthLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="page-header mb-0">API Sandbox</h1>
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 border border-amber-300 dark:border-amber-700 text-xs font-mono px-2">
              SANDBOX
            </Badge>
          </div>
          <p className="page-description">Test the payment API safely. Requests here use your actual backend but are clearly marked as sandbox calls.</p>
        </div>
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-amber-500" />
          <span className="text-xs text-muted-foreground">No real money is moved in sandbox mode.</span>
        </div>
      </div>

      {/* Auth context strip */}
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-2.5 flex items-center gap-3 text-xs text-muted-foreground">
        <FlaskConical className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span>
          <span className="font-medium text-foreground">API Key:</span>{' '}
          <code className="font-mono">{apiKey ? '••••••' + apiKey.slice(-4) : 'Not configured — check Settings'}</code>
          <span className="ml-4 text-amber-600 dark:text-amber-400 font-medium">All responses are from the live backend.</span>
        </span>
      </div>

      <Tabs defaultValue="create" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="create">
            <span className="text-xs font-bold px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 font-mono mr-1.5">POST</span>
            Create Payment
          </TabsTrigger>
          <TabsTrigger value="status">
            <span className="text-xs font-bold px-1 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 font-mono mr-1.5">GET</span>
            Check Status
          </TabsTrigger>
          <TabsTrigger value="all">
            <span className="text-xs font-bold px-1 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 font-mono mr-1.5">GET</span>
            All Payments
          </TabsTrigger>
          <TabsTrigger value="health">
            <span className="text-xs font-bold px-1 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 font-mono mr-1.5">GET</span>
            Health
          </TabsTrigger>
        </TabsList>

        {/* ── Create ──────────────────────────────────────────────────────── */}
        <TabsContent value="create">
          <Card className="border-amber-200 dark:border-amber-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 font-mono">POST</span>
                <span className="font-mono text-sm">/api/payments/create</span>
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">sandbox</Badge>
              </CardTitle>
              <CardDescription>Pre-filled with sandbox defaults. Modify fields to test edge cases.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">applicant_id</Label>
                  <Input value={createForm.applicant_id} onChange={(e) => setCreateForm({ ...createForm, applicant_id: e.target.value })} className="rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">application_id</Label>
                  <Input value={createForm.application_id} onChange={(e) => setCreateForm({ ...createForm, application_id: e.target.value })} className="rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">posting_id</Label>
                  <Input value={createForm.posting_id} onChange={(e) => setCreateForm({ ...createForm, posting_id: e.target.value })} className="rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">amount (PKR)</Label>
                  <Input type="number" value={createForm.amount} onChange={(e) => setCreateForm({ ...createForm, amount: Number(e.target.value) || 0 })} className="rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">expires_in_minutes</Label>
                  <Input type="number" min={0} disabled={createForm.never_expires} value={createForm.expires_in_minutes} onChange={(e) => setCreateForm({ ...createForm, expires_in_minutes: Number(e.target.value) || 0 })} className="rounded-lg" />
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <Checkbox id="sb_never_expires" checked={createForm.never_expires} onCheckedChange={(checked) => setCreateForm({ ...createForm, never_expires: Boolean(checked), expires_in_minutes: 0 })} />
                  <Label htmlFor="sb_never_expires" className="text-xs cursor-pointer flex items-center gap-1">
                    <InfinityIcon className="w-3.5 h-3.5" /> Never expires
                  </Label>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">description</Label>
                  <Input value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} className="rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">customer_name</Label>
                  <Input value={createForm.customer_name} onChange={(e) => setCreateForm({ ...createForm, customer_name: e.target.value })} className="rounded-lg" />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => void handleCreate()} disabled={createLoading} className="rounded-lg">
                  {createLoading ? 'Creating…' : 'Send Request'}
                </Button>
                {createResult?.consumerNumber && (
                  <Button variant="outline" size="sm" className="rounded-lg font-mono text-xs" onClick={() => copyText(createResult.consumerNumber!, 'consNum')}>
                    {copied === 'consNum' ? <CheckCheck className="w-3.5 h-3.5 mr-1 text-success" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    {createResult.consumerNumber}
                  </Button>
                )}
              </div>

              {codeBlock(
                createResult ? JSON.stringify({
                  payment_id: createResult.paymentId,
                  consumer_number: createResult.consumerNumber,
                  status: createResult.status,
                  amount: formatPKR(createResult.oneBillRequest.amount),
                }, null, 2) : `// Hit "Send Request" to see the response\n{}`,
                createResult ? <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400">201 Created</span> : null
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Status ──────────────────────────────────────────────────────── */}
        <TabsContent value="status">
          <Card className="border-amber-200 dark:border-amber-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 font-mono">GET</span>
                <span className="font-mono text-sm">/api/payments/{'{application_id}'}</span>
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">sandbox</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input value={lookupId} onChange={(e) => setLookupId(e.target.value)} className="rounded-lg" placeholder="APP-SANDBOX-001" />
                <Button variant="outline" className="rounded-lg" onClick={() => void handleLookup()} disabled={lookupLoading}>
                  {lookupLoading ? 'Looking up…' : 'Lookup'}
                </Button>
              </div>
              {codeBlock(
                lookupResult ? JSON.stringify({
                  application_id: lookupResult.applicationId,
                  status: lookupResult.status,
                  ...(lookupResult.payment ? {
                    consumer_number: lookupResult.payment.consumerNumber ?? null,
                    amount: lookupResult.payment.amount,
                    paid_at: lookupResult.payment.paidAt ?? null,
                    transaction_id: lookupResult.payment.transactionId ?? null,
                  } : {}),
                }, null, 2) : `// Enter application_id and hit Lookup\n{}`,
                lookupResult ? (
                  <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${lookupResult.status === 'not_found' ? 'bg-red-950 text-red-400' : 'bg-emerald-950 text-emerald-400'}`}>
                    {lookupResult.status === 'not_found' ? '404 Not Found' : '200 OK'}
                  </span>
                ) : null
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── All Payments ─────────────────────────────────────────────────── */}
        <TabsContent value="all">
          <Card className="border-amber-200 dark:border-amber-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 font-mono">GET</span>
                <span className="font-mono text-sm">/api/payments</span>
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">sandbox</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="rounded-lg" onClick={() => void handleFetchAll()} disabled={allLoading}>
                {allLoading ? 'Fetching…' : 'Fetch All Payments'}
              </Button>
              {codeBlock(
                allPayments ? JSON.stringify(allPayments.slice(0, 20).map((p) => ({
                  application_id: p.applicationId,
                  applicant_id: p.applicantId,
                  posting_id: p.postingId,
                  consumer_number: p.consumerNumber ?? null,
                  amount: p.amount,
                  status: p.status,
                })), null, 2) : `// Hit "Fetch All Payments"\n[]`,
                allPayments ? <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400">200 OK · {allPayments.length} records</span> : null
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Health ──────────────────────────────────────────────────────── */}
        <TabsContent value="health">
          <Card className="border-amber-200 dark:border-amber-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 font-mono">GET</span>
                <span className="font-mono text-sm">/api/health</span>
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">sandbox</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="rounded-lg" onClick={() => void handleHealth()} disabled={healthLoading}>
                {healthLoading ? 'Checking…' : 'Run Health Check'}
              </Button>
              {codeBlock(
                health ? JSON.stringify({ service: health.service, status: health.status, timestamp: health.timestamp }, null, 2) : `// Hit "Run Health Check"\n{}`,
                health ? <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400">200 OK</span> : null
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrgSandbox;
