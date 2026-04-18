import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatPKR } from '@/lib/formatters';
import { usePaymentStore } from '@/store/paymentStore';
import { useOrgSecurityStore } from '@/store/orgSecurityStore';
import {
  OrgCreatePaymentResponse,
  OrgHealthResponse,
  OrgPaymentStatusResponse,
  OrgPaymentNotification,
  OrgPaymentRecord,
} from '@/types';
import { useApiQuery } from '@/hooks/useApiQuery';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Checkbox } from '@/components/ui/checkbox';
import { Copy, Loader2, Infinity as InfinityIcon } from 'lucide-react';

const OrgPayments = () => {
  const paymentVersion = usePaymentStore((state) => state.version);

  const [notifTick, setNotifTick] = useState(0);
  const notifIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    notifIntervalRef.current = setInterval(() => setNotifTick((t) => t + 1), 5000);
    return () => { if (notifIntervalRef.current) clearInterval(notifIntervalRef.current); };
  }, []);

  const { data: notificationsData } = useApiQuery(() => api.listOrgPaymentNotifications(), [paymentVersion, notifTick]);
  const notifications = (notificationsData || []) as OrgPaymentNotification[];
  const [searchParams] = useSearchParams();

  const queryApplicationId = searchParams.get('application') || '';

  const apiKey = useOrgSecurityStore((state) => state.apiKey);
  const sourceIp = useOrgSecurityStore((state) => state.sourceIp);

  const [createForm, setCreateForm] = useState({
    applicant_id: '',
    application_id: queryApplicationId,
    posting_id: '',
    amount: 0,
    expires_in_minutes: 0,
    never_expires: false,
    description: '',
    customer_name: '',
  });

  const [lookupApplicationId, setLookupApplicationId] = useState(queryApplicationId);
  const [createResult, setCreateResult] = useState<OrgCreatePaymentResponse | null>(null);
  const [lookupResult, setLookupResult] = useState<OrgPaymentStatusResponse | null>(null);
  const [allPaymentsResult, setAllPaymentsResult] = useState<OrgPaymentRecord[] | null>(null);
  const [health, setHealth] = useState<OrgHealthResponse | null>(null);

  useEffect(() => {
    if (!queryApplicationId) return;
    setCreateForm((current) => ({ ...current, application_id: queryApplicationId }));
    setLookupApplicationId(queryApplicationId);
  }, [queryApplicationId]);

  useEffect(() => {
    const doExpire = async () => {
      try {
        const res = await api.expireOverduePayments();
        const expired = (res.data as { expired: number })?.expired || 0;
        if (expired > 0) {
          toast.info(`${expired} pending payment record(s) expired`);
          refetchPayments();
        }
      } catch { /* ignore */ }
    };
    void doExpire();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentVersion]);

  const handleCreatePayment = async () => {
    if (!createForm.applicant_id.trim()) { toast.error('applicant_id is required'); return; }
    if (!createForm.application_id.trim()) { toast.error('application_id is required'); return; }
    if (!createForm.posting_id.trim()) { toast.error('posting_id is required'); return; }
    if (createForm.amount <= 0) { toast.error('amount must be greater than zero'); return; }
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
      setLookupApplicationId(created.payment.applicationId);
      setLookupResult({ applicationId: created.payment.applicationId, status: created.status, payment: created.payment });
      usePaymentStore.getState().bump();
      toast.success(`Payment request created (${created.paymentId})`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create payment request');
    }
  };

  const handleLookup = async () => {
    if (!lookupApplicationId.trim()) { toast.error('application_id is required'); return; }
    try {
      const res = await api.getOrgPaymentStatus(lookupApplicationId.trim());
      const status = res.data as OrgPaymentStatusResponse;
      setLookupResult(status);
      if (status.status === 'not_found') { toast.error('No payment record found for this application'); return; }
      toast.success(`Status fetched: ${status.status}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Status lookup failed');
    }
  };

  const handleHealthCheck = async () => {
    try {
      const res = await api.orgHealthCheck();
      setHealth(res.data as OrgHealthResponse);
      toast.success('Health check passed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Health check failed');
    }
  };

  const handleFetchAllPayments = async () => {
    try {
      const res = await api.listOrgPayments();
      setAllPaymentsResult((res.data as OrgPaymentRecord[]) ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch payments');
    }
  };

  const refetchPayments = () => { void handleFetchAllPayments(); };

  const payloadDisplay = createResult
    ? {
        application_id: (createResult.oneBillRequest as unknown as Record<string, unknown>).applicationId ?? createResult.paymentId,
        consumer_number: createResult.consumerNumber ?? null,
        status: createResult.status,
        amount: createResult.oneBillRequest.amount,
        expires: (createResult.oneBillRequest as unknown as Record<string, unknown>).expires ?? null,
        never_expires: (createResult.oneBillRequest as unknown as Record<string, unknown>).neverExpires ?? false,
        customer_name: createResult.oneBillRequest.customerName,
        description: (createResult.oneBillRequest as unknown as Record<string, unknown>).description ?? null,
      }
    : null;

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

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="page-header">Payment Controller</h1>
        <p className="page-description">
          Create payment requests, check status, and monitor callbacks. Your system generates a 1BILL consumer number; the applicant pays via ATM or mobile banking.
        </p>
      </div>

      <div className="rounded-lg border bg-muted/30 px-4 py-2.5 flex items-center gap-3 text-xs text-muted-foreground">
        <Copy className="w-3.5 h-3.5 shrink-0" />
        <span>
          <span className="font-medium text-foreground">API Key:</span>{' '}
          <code className="font-mono">{apiKey ? '••••••••' + apiKey.slice(-6) : 'Not configured — go to Settings'}</code>
          {sourceIp ? <span className="ml-4"><span className="font-medium text-foreground">Source IP:</span> {sourceIp}</span> : null}
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
          <TabsTrigger value="notifications">
            <span className="text-xs font-bold px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 font-mono mr-1.5">POST</span>
            Notifications
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

        {/* ── Create Payment ─────────────────────────────────── */}
        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 font-mono">POST</span>
                <span className="font-mono text-sm">/api/payments/create</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">applicant_id</Label>
                  <Input value={createForm.applicant_id} onChange={(e) => setCreateForm({ ...createForm, applicant_id: e.target.value })} className="rounded-lg" placeholder="STU-9981" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">application_id</Label>
                  <Input value={createForm.application_id} onChange={(e) => setCreateForm({ ...createForm, application_id: e.target.value })} className="rounded-lg" placeholder="APP-44521" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">posting_id</Label>
                  <Input value={createForm.posting_id} onChange={(e) => setCreateForm({ ...createForm, posting_id: e.target.value })} className="rounded-lg" placeholder="LECTURER-2026" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">amount (PKR)</Label>
                  <Input type="number" value={createForm.amount} onChange={(e) => setCreateForm({ ...createForm, amount: Number(e.target.value) || 0 })} className="rounded-lg" placeholder="1200" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">expires_in_minutes (0 = server default)</Label>
                  <Input type="number" min={0} disabled={createForm.never_expires} value={createForm.expires_in_minutes} onChange={(e) => setCreateForm({ ...createForm, expires_in_minutes: Number(e.target.value) || 0 })} className="rounded-lg" placeholder="e.g. 30" />
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <Checkbox id="never_expires" checked={createForm.never_expires} onCheckedChange={(checked) => setCreateForm({ ...createForm, never_expires: Boolean(checked), expires_in_minutes: 0 })} />
                  <Label htmlFor="never_expires" className="text-xs cursor-pointer flex items-center gap-1">
                    <InfinityIcon className="w-3.5 h-3.5" /> Never expires
                  </Label>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">description</Label>
                  <Input value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} className="rounded-lg" placeholder="Application fee" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">customer_name (optional)</Label>
                  <Input value={createForm.customer_name} onChange={(e) => setCreateForm({ ...createForm, customer_name: e.target.value })} className="rounded-lg" placeholder="Ali Khan" />
                </div>
              </div>

              <Button onClick={() => void handleCreatePayment()} className="rounded-lg">Create Payment Request</Button>

              {codeBlock(
                payloadDisplay ? JSON.stringify(payloadDisplay, null, 2) : `// Hit "Create Payment Request" to see the response\n{}`,
                payloadDisplay ? (
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400">201 Created</span>
                ) : null
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Check Status ───────────────────────────────────── */}
        <TabsContent value="status">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 font-mono">GET</span>
                <span className="font-mono text-sm">/api/payments/{'{application_id}'}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input value={lookupApplicationId} onChange={(e) => setLookupApplicationId(e.target.value)} className="rounded-lg" placeholder="APP-44521" />
                <Button variant="outline" className="rounded-lg" onClick={() => void handleLookup()}>Lookup</Button>
              </div>
              {codeBlock(
                lookupResult
                  ? JSON.stringify({
                      application_id: lookupResult.applicationId,
                      status: lookupResult.status,
                      ...(lookupResult.payment ? {
                        consumer_number: lookupResult.payment.consumerNumber ?? null,
                        amount: lookupResult.payment.amount,
                        expires: lookupResult.payment.expiryDate ?? null,
                        paid_at: lookupResult.payment.paidAt ?? null,
                        transaction_id: lookupResult.payment.transactionId ?? null,
                        description: lookupResult.payment.description ?? null,
                      } : {}),
                    }, null, 2)
                  : `// Enter an application_id and hit Lookup\n{}`,
                lookupResult ? (
                  <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${lookupResult.status === 'not_found' ? 'bg-red-950 text-red-400' : 'bg-emerald-950 text-emerald-400'}`}>
                    {lookupResult.status === 'not_found' ? '404 Not Found' : '200 OK'}
                  </span>
                ) : null
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Notifications ──────────────────────────────────── */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 font-mono">POST</span>
                <span className="font-mono text-sm">/api/org/payment-status</span>
                <span className="text-xs text-muted-foreground font-sans font-normal">— Outbound callbacks sent to your endpoint</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                When a payment is confirmed by 1BILL, the platform POSTs a notification to your configured callback URL. The list below shows recent outbound events.
              </p>
              {codeBlock(
                notifications.length > 0
                  ? JSON.stringify(notifications.slice(0, 8).map((n) => ({
                      application_id: n.applicationId,
                      status: n.status,
                      sent_at: n.sentAt,
                    })), null, 2)
                  : `// No notifications sent yet\n[]`,
                notifications.length > 0 ? (
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400">200 OK · {notifications.length} events</span>
                ) : null
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── All Payments ───────────────────────────────────── */}
        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 font-mono">GET</span>
                <span className="font-mono text-sm">/api/payments</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="rounded-lg" onClick={() => void handleFetchAllPayments()}>Fetch All Payments</Button>
              {codeBlock(
                allPaymentsResult
                  ? JSON.stringify(allPaymentsResult.map((p) => ({
                      application_id: p.applicationId,
                      applicant_id: p.applicantId,
                      posting_id: p.postingId,
                      consumer_number: p.consumerNumber ?? null,
                      amount: p.amount,
                      status: p.status,
                      created_at: p.createdAt,
                      paid_at: p.paidAt ?? null,
                      transaction_id: p.transactionId ?? null,
                    })), null, 2)
                  : `// Hit "Fetch All Payments" to see the response\n[]`,
                allPaymentsResult ? (
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400">200 OK · {allPaymentsResult.length} records</span>
                ) : null
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Health ─────────────────────────────────────────── */}
        <TabsContent value="health">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 font-mono">GET</span>
                <span className="font-mono text-sm">/api/health</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="rounded-lg" onClick={() => void handleHealthCheck()}>Run Health Check</Button>
              {codeBlock(
                health
                  ? JSON.stringify({ service: health.service, status: health.status, timestamp: health.timestamp }, null, 2)
                  : `// Hit "Run Health Check" to see the response\n{}`,
                health ? (
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400">200 OK</span>
                ) : null
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrgPayments;
