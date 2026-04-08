import { useEffect, useMemo, useState } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { EteaPaymentRecord } from '@/types';
import { usePaymentStore } from '@/store/paymentStore';
import { formatPKR } from '@/lib/formatters';

const formatTimestamp = (value?: string) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ETEARealtimePayments = () => {
  const paymentVersion = usePaymentStore((state) => state.version);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [liveClock, setLiveClock] = useState(() => new Date());
  const [lastLiveUpdateAt, setLastLiveUpdateAt] = useState<string | null>(null);

  useEffect(() => {
    if (!autoRefresh) return;
    const intervalId = window.setInterval(() => {
      setLiveClock(new Date());
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [autoRefresh]);

  useEffect(() => {
    if (paymentVersion === 0) return;
    const now = new Date();
    setLiveClock(now);
    setLastLiveUpdateAt(now.toISOString());
  }, [paymentVersion]);

  const { data: paymentsData, loading } = useApiQuery(() => api.listEteaPayments(), [paymentVersion, liveClock]);
  const allPayments = (paymentsData || []) as EteaPaymentRecord[];

  const paidPayments = useMemo(
    () =>
      allPayments
        .filter((payment) => payment.status === 'paid')
        .sort((left, right) => {
          const leftTime = new Date(left.paidAt || left.createdAt).getTime();
          const rightTime = new Date(right.paidAt || right.createdAt).getTime();
          return rightTime - leftTime;
        }),
    [allPayments]
  );

  const todayKey = liveClock.toISOString().slice(0, 10);
  const todaysPaidPayments = paidPayments.filter((payment) =>
    (payment.paidAt || payment.createdAt).slice(0, 10) === todayKey
  );
  const todaysTotal = todaysPaidPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const lastPayment = paidPayments[0] || null;

  if (loading && allPayments.length === 0) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-1">
        <h1 className="page-header">Real-Time Payments</h1>
        <p className="page-description">Live feed of paid ETEA application transactions.</p>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">ETEA Payments Stream</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Last sync: {formatTimestamp(lastLiveUpdateAt || liveClock.toISOString())}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg"
                onClick={() => setAutoRefresh((current) => !current)}
              >
                {autoRefresh ? 'Pause live refresh' : 'Resume live refresh'}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-[11px] text-muted-foreground">Paid transactions (session)</p>
              <p className="mt-1 text-xl font-semibold">{paidPayments.length}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-[11px] text-muted-foreground">Collected today</p>
              <p className="mt-1 text-xl font-semibold text-success">{formatPKR(todaysTotal)}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-[11px] text-muted-foreground">Today paid count</p>
              <p className="mt-1 text-xl font-semibold">{todaysPaidPayments.length}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-[11px] text-muted-foreground">Most recent bill ID</p>
              <p className="mt-1 text-sm font-semibold font-mono break-all">{lastPayment?.billId || 'No live payment yet'}</p>
            </div>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Payment ID</TableHead>
                  <TableHead>Application ID</TableHead>
                  <TableHead>Bill ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Transaction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paidPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                      No paid ETEA payment events yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  paidPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-xs text-muted-foreground">{formatTimestamp(payment.paidAt || payment.createdAt)}</TableCell>
                      <TableCell className="font-mono text-xs">{payment.id}</TableCell>
                      <TableCell className="font-mono text-xs">{payment.applicationId}</TableCell>
                      <TableCell className="font-mono text-xs break-all">{payment.billId}</TableCell>
                      <TableCell className="font-semibold text-success">{formatPKR(payment.amount)}</TableCell>
                      <TableCell><StatusBadge status={payment.status} /></TableCell>
                      <TableCell className="font-mono text-xs">{payment.transactionId || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ETEARealtimePayments;
