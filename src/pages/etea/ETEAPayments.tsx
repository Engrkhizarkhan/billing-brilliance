import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilterBar } from '@/components/FilterBar';
import { StatusBadge } from '@/components/StatusBadge';
import { TablePagination } from '@/components/TablePagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  generateWebhookSignature,
  eteaPaymentControllerConfig,
} from '@/services/eteaPaymentController';
import { formatPKR } from '@/lib/formatters';
import { usePaymentStore } from '@/store/paymentStore';
import { useEteaSecurityStore } from '@/store/eteaSecurityStore';
import {
  EteaCreatePaymentResponse,
  EteaHealthResponse,
  EteaPaymentCallbackResponse,
  EteaPaymentRecord,
  EteaPaymentNotification,
  EteaPaymentStatus,
  EteaPaymentStatusResponse,
} from '@/types';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Copy, Loader2 } from 'lucide-react';

const getDefaultDueDate = () => {
  const target = new Date();
  target.setDate(target.getDate() + 2);
  return target.toISOString().slice(0, 10);
};

const CALLBACK_STATUS_OPTIONS: Array<Extract<EteaPaymentStatus, 'paid' | 'failed' | 'expired'>> = [
  'paid',
  'failed',
  'expired',
];

const ETEAPayments = () => {
  const paymentVersion = usePaymentStore((state) => state.version);
  const [searchParams] = useSearchParams();

  const queryApplicationId = searchParams.get('application') || '';

  const apiKey = useEteaSecurityStore((state) => state.apiKey);
  const sourceIp = useEteaSecurityStore((state) => state.sourceIp);

  const [createForm, setCreateForm] = useState({
    applicant_id: '',
    application_id: queryApplicationId,
    posting_id: '',
    amount: 0,
    due_date: getDefaultDueDate(),
    description: '',
    customer_name: '',
  });

  const [lookupApplicationId, setLookupApplicationId] = useState(queryApplicationId);
  const [callbackForm, setCallbackForm] = useState({
    bill_id: '',
    status: 'paid' as Extract<EteaPaymentStatus, 'paid' | 'failed' | 'expired'>,
    transaction_id: `TXN-${Date.now()}`,
    paid_at: new Date().toISOString().slice(0, 16),
  });

  const [createResult, setCreateResult] = useState<EteaCreatePaymentResponse | null>(null);
  const [lookupResult, setLookupResult] = useState<EteaPaymentStatusResponse | null>(null);
  const [callbackResult, setCallbackResult] = useState<EteaPaymentCallbackResponse | null>(null);
  const [health, setHealth] = useState<EteaHealthResponse | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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
    doExpire();
  }, [paymentVersion]);

  const handleCreatePayment = async () => {
    if (!createForm.applicant_id.trim()) {
      toast.error('applicant_id is required');
      return;
    }

    if (!createForm.application_id.trim()) {
      toast.error('application_id is required');
      return;
    }

    if (!createForm.posting_id.trim()) {
      toast.error('posting_id is required');
      return;
    }

    if (createForm.amount <= 0) {
      toast.error('amount must be greater than zero');
      return;
    }

    if (!createForm.due_date.trim()) {
      toast.error('due_date is required');
      return;
    }

    try {
      const res = await api.createEteaPayment({
        applicantId: createForm.applicant_id,
        applicationId: createForm.application_id,
        postingId: createForm.posting_id,
        amount: createForm.amount,
        dueDate: createForm.due_date,
        description: createForm.description || undefined,
        customerName: createForm.customer_name || createForm.applicant_id,
      });

      const created = res.data as EteaCreatePaymentResponse;
      setCreateResult(created);
      setLookupApplicationId(created.payment.applicationId);
      setLookupResult({
        applicationId: created.payment.applicationId,
        status: created.status,
        payment: created.payment,
      });
      setCallbackForm((current) => ({
        ...current,
        bill_id: created.billId,
        transaction_id: `TXN-${Date.now()}`,
      }));

      await refetchPayments();
      toast.success(`Payment request created (${created.paymentId})`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create payment request');
    }
  };

  const handleLookup = async () => {
    if (!lookupApplicationId.trim()) {
      toast.error('application_id is required');
      return;
    }

    try {
      const res = await api.getEteaPaymentStatus(lookupApplicationId.trim());
      const status = res.data as EteaPaymentStatusResponse;
      setLookupResult(status);
      if (status.status === 'not_found') {
        toast.error('No payment record found for this application');
        return;
      }
      toast.success(`Status fetched: ${status.status}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Status lookup failed');
    }
  };

  const handleProcessCallback = async () => {
    if (!callbackForm.bill_id.trim()) {
      toast.error('bill_id is required for callback');
      return;
    }

    if (!callbackForm.transaction_id.trim()) {
      toast.error('transaction_id is required for callback');
      return;
    }

    try {
      const callbackPayload = {
        billId: callbackForm.bill_id.trim(),
        status: callbackForm.status,
        transactionId: callbackForm.transaction_id.trim(),
        paidAt: callbackForm.paid_at ? new Date(callbackForm.paid_at).toISOString() : undefined,
      };
      const webhookSignature = generateWebhookSignature(callbackPayload);
      const idempotencyKey = `cb:${callbackPayload.billId}:${callbackPayload.status}:${callbackPayload.transactionId}`;

      const res = await api.processEteaPaymentCallback({
        ...callbackPayload,
        webhookSignature,
        idempotencyKey,
      });

      const callback = res.data as EteaPaymentCallbackResponse;
      setCallbackResult(callback);
      if (callback.payment) {
        const lookupRes = await api.getEteaPaymentStatus(callback.payment.applicationId);
        setLookupResult(lookupRes.data as EteaPaymentStatusResponse);
        setLookupApplicationId(callback.payment.applicationId);
      }

      await refetchPayments();
      await refetchNotifications();

      if (!callback.acknowledged) {
        toast.error(callback.message);
        return;
      }
      toast.success(callback.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Callback processing failed');
    }
  };

  const handleHealthCheck = async () => {
    try {
      const res = await api.eteaHealthCheck();
      const healthResponse = res.data as EteaHealthResponse;
      setHealth(healthResponse);
      toast.success('Health check passed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Health check failed');
    }
  };

  const { data: paymentsData, loading: loadingPayments, refetch: refetchPayments } = useApiQuery(() => api.listEteaPayments(), [paymentVersion]);
  const paymentRecords = (paymentsData || []) as EteaPaymentRecord[];

  const filteredPayments = useMemo(() => {
    const query = search.toLowerCase();
    return paymentRecords.filter((payment) => {
      const matchesSearch =
        payment.id.toLowerCase().includes(query) ||
        payment.applicationId.toLowerCase().includes(query) ||
        payment.applicantId.toLowerCase().includes(query) ||
        payment.postingId.toLowerCase().includes(query) ||
        payment.billId.toLowerCase().includes(query) ||
        (payment.consumerNumber || '').toLowerCase().includes(query) ||
        payment.transactionId?.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
      return Boolean(matchesSearch && matchesStatus);
    });
  }, [paymentRecords, search, statusFilter]);

  const paginatedPayments = filteredPayments.slice((page - 1) * pageSize, page * pageSize);

  const { data: notificationsData, refetch: refetchNotifications } = useApiQuery(() => api.listEteaPaymentNotifications(), [paymentVersion]);
  const notifications = (notificationsData || []) as EteaPaymentNotification[];

  const oneBillPayload = createResult
    ? {
        bill_id: createResult.oneBillRequest.billId,
        amount: createResult.oneBillRequest.amount,
        due_date: createResult.oneBillRequest.dueDate,
        customer_name: createResult.oneBillRequest.customerName,
        callback_url: createResult.oneBillRequest.callbackUrl,
      }
    : null;

  if (loadingPayments && paymentRecords.length === 0) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">ETEA Payment Controller</h1>
        <p className="page-description">
          Government testing body flow: ETEA creates payment request, system creates temporary payment record, creates 1Bill payload, processes callback, then notifies ETEA.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Architecture Contract</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Create Endpoint</p>
            <p className="font-mono text-xs">{eteaPaymentControllerConfig.endpoints.create}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Callback Endpoint</p>
            <p className="font-mono text-xs">{eteaPaymentControllerConfig.endpoints.callback}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Notify Endpoint</p>
            <p className="font-mono text-xs">{eteaPaymentControllerConfig.endpoints.notifyEtea}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Bill ID Pattern</p>
            <p className="font-mono text-xs">{eteaPaymentControllerConfig.billIdPattern}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">POST /api/payments/create</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">applicant_id</Label>
              <Input
                value={createForm.applicant_id}
                onChange={(event) => setCreateForm({ ...createForm, applicant_id: event.target.value })}
                className="rounded-lg"
                placeholder="STU-9981"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">application_id</Label>
              <Input
                value={createForm.application_id}
                onChange={(event) => setCreateForm({ ...createForm, application_id: event.target.value })}
                className="rounded-lg"
                placeholder="APP-44521"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">posting_id</Label>
              <Input
                value={createForm.posting_id}
                onChange={(event) => setCreateForm({ ...createForm, posting_id: event.target.value })}
                className="rounded-lg"
                placeholder="LECTURER-2026"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">amount</Label>
              <Input
                type="number"
                value={createForm.amount}
                onChange={(event) => setCreateForm({ ...createForm, amount: Number(event.target.value) || 0 })}
                className="rounded-lg"
                placeholder="1200"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">due_date</Label>
              <Input
                type="date"
                value={createForm.due_date}
                onChange={(event) => setCreateForm({ ...createForm, due_date: event.target.value })}
                className="rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">description</Label>
              <Input
                value={createForm.description}
                onChange={(event) => setCreateForm({ ...createForm, description: event.target.value })}
                className="rounded-lg"
                placeholder="Lecturer application fee"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">customer_name (optional)</Label>
              <Input
                value={createForm.customer_name}
                onChange={(event) => setCreateForm({ ...createForm, customer_name: event.target.value })}
                className="rounded-lg"
                placeholder="Ali Khan"
              />
            </div>
          </div>

          <Button onClick={handleCreatePayment} className="rounded-lg">Create Payment Request</Button>

          {createResult ? (
            <div className="rounded-lg border bg-muted/20 p-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">payment_id</p>
                <p className="font-mono font-semibold">{createResult.paymentId}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">bill_id</p>
                <p className="font-mono font-semibold break-all">{createResult.billId}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">status</p>
                <div className="mt-1"><StatusBadge status={createResult.status} /></div>
              </div>
              {createResult.consumerNumber ? (
                <div className="md:col-span-3 rounded-lg border-2 border-primary/30 bg-primary/5 p-3">
                  <p className="text-xs font-medium text-primary mb-1">1BILL Consumer Number — give this to the applicant to pay via ATM or mobile banking</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-lg font-bold tracking-widest">{createResult.consumerNumber}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        navigator.clipboard.writeText(createResult.consumerNumber!);
                        toast.success('Consumer number copied');
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
              <div className="md:col-span-3 rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground mb-2">Generated 1Bill Create-Bill Payload</p>
                <pre className="text-xs overflow-auto whitespace-pre-wrap">
{JSON.stringify(oneBillPayload, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">GET /api/payments/{'{application_id}'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={lookupApplicationId}
                onChange={(event) => setLookupApplicationId(event.target.value)}
                className="rounded-lg"
                placeholder="APP-44521"
              />
              <Button variant="outline" className="rounded-lg" onClick={handleLookup}>Lookup</Button>
            </div>

            {lookupResult ? (
              <div className="rounded-lg border p-3 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">application_id: {lookupResult.applicationId}</p>
                  <StatusBadge status={lookupResult.status} />
                </div>
                {lookupResult.payment ? (
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <p>payment_id: <span className="font-mono">{lookupResult.payment.id}</span></p>
                    <p>bill_id: <span className="font-mono">{lookupResult.payment.billId}</span></p>
                    <p>amount: <span className="font-medium text-foreground">{formatPKR(lookupResult.payment.amount)}</span></p>
                    <p>status: <span className="text-foreground">{lookupResult.payment.status}</span></p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">POST /api/payment/callback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">bill_id</Label>
                <Input
                  value={callbackForm.bill_id}
                  onChange={(event) => setCallbackForm({ ...callbackForm, bill_id: event.target.value })}
                  className="rounded-lg font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">status</Label>
                <Select
                  value={callbackForm.status}
                  onValueChange={(value: Extract<EteaPaymentStatus, 'paid' | 'failed' | 'expired'>) =>
                    setCallbackForm({ ...callbackForm, status: value })
                  }
                >
                  <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CALLBACK_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">transaction_id</Label>
                <Input
                  value={callbackForm.transaction_id}
                  onChange={(event) => setCallbackForm({ ...callbackForm, transaction_id: event.target.value })}
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">paid_at</Label>
                <Input
                  type="datetime-local"
                  value={callbackForm.paid_at}
                  onChange={(event) => setCallbackForm({ ...callbackForm, paid_at: event.target.value })}
                  className="rounded-lg"
                />
              </div>
            </div>

            <Button variant="outline" className="rounded-lg" onClick={handleProcessCallback}>Process Callback</Button>

            {callbackResult ? (
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{callbackResult.message}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  acknowledged: {callbackResult.acknowledged ? 'true' : 'false'}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">GET /api/health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="rounded-lg" onClick={handleHealthCheck}>Run Health Check</Button>
          {health ? (
            <p className="text-sm text-muted-foreground">
              {health.service} - {health.status} ({health.timestamp})
            </p>
          ) : null}
        </CardContent>
      </Card>

      <FilterBar
        searchPlaceholder="Search payments by payment_id, application_id, applicant_id, posting_id, consumer #, bill_id, or transaction_id..."
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'pending', label: 'Pending' },
              { value: 'paid', label: 'Paid' },
              { value: 'failed', label: 'Failed' },
              { value: 'expired', label: 'Expired' },
            ],
          },
        ]}
        onFilterChange={(_, value) => {
          setStatusFilter(value);
          setPage(1);
        }}
      />

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>payment_id</TableHead>
              <TableHead>application_id</TableHead>
              <TableHead>applicant_id</TableHead>
              <TableHead>posting_id</TableHead>
              <TableHead>consumer #</TableHead>
              <TableHead>bill_id</TableHead>
              <TableHead>amount</TableHead>
              <TableHead>status</TableHead>
              <TableHead>created_at</TableHead>
              <TableHead>paid_at</TableHead>
              <TableHead>transaction_id</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedPayments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-6">
                  No payment records match your filters.
                </TableCell>
              </TableRow>
            ) : (
              paginatedPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-mono text-xs">{payment.id}</TableCell>
                  <TableCell className="font-mono text-xs">{payment.applicationId}</TableCell>
                  <TableCell className="font-mono text-xs">{payment.applicantId}</TableCell>
                  <TableCell className="font-mono text-xs">{payment.postingId}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {payment.consumerNumber ? (
                      <div className="flex items-center gap-1">
                        <span className="tracking-wider">{payment.consumerNumber}</span>
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => { navigator.clipboard.writeText(payment.consumerNumber!); toast.success('Copied'); }}
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs break-all">{payment.billId}</TableCell>
                  <TableCell className="font-mono text-sm">{formatPKR(payment.amount)}</TableCell>
                  <TableCell><StatusBadge status={payment.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{payment.createdAt}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{payment.paidAt || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{payment.transactionId || '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <TablePagination
          total={filteredPayments.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">POST /api/etea/payment-status</CardTitle>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications sent to ETEA yet.</p>
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, 8).map((notification) => (
                <div key={notification.id} className="rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">application_id: {notification.applicationId}</p>
                    <p className="text-xs text-muted-foreground font-mono">bill_id: {notification.billId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={notification.status} />
                    <span className="text-xs text-muted-foreground">{notification.sentAt}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ETEAPayments;
