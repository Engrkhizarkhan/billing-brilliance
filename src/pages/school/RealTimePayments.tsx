import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { usePaymentStore } from '@/store/paymentStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity } from 'lucide-react';
import { formatPKR } from '@/lib/formatters';

const formatRealtimeTimestamp = (value: string) => {
  const normalized = value.includes('T') ? value : `${value}T00:00:00`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const RealTimePayments = () => {
  const paymentVersion = usePaymentStore((state) => state.version);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [liveClock, setLiveClock] = useState(() => new Date());
  const [lastLiveUpdateAt, setLastLiveUpdateAt] = useState<string | null>(null);
  const sessionStartRef = useRef(new Date());

  const { data: txnData, refetch: refetchTxns } = useApiQuery(() => api.fetchTransactions({}), [paymentVersion]);
  const transactions = (txnData || []) as Array<{ id: string; transactionId: string; consumerNumber: string; amount: number; status: string; date: string; billerName: string; createdAt?: string }>;

  useEffect(() => {
    if (!autoRefresh) return;
    const intervalId = window.setInterval(() => {
      setLiveClock(new Date());
      void refetchTxns();
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, [autoRefresh, refetchTxns]);

  useEffect(() => {
    if (paymentVersion === 0) return;
    const now = new Date();
    setLiveClock(now);
    setLastLiveUpdateAt(now.toISOString());
  }, [paymentVersion]);

  const realtimeTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.status === 'completed').slice(0, 20),
    [transactions]
  );

  const sessionLiveIds = useMemo(
    () => new Set(transactions
      .filter((t) => t.createdAt && new Date(t.createdAt) >= sessionStartRef.current)
      .map((t) => t.id)),
    [transactions]
  );

  const sessionRealtimePayments = useMemo(
    () => realtimeTransactions.filter((t) => sessionLiveIds.has(t.id)),
    [realtimeTransactions, sessionLiveIds]
  );

  const todayKey = liveClock.toISOString().slice(0, 10);
  const todaysRealtimeTransactions = realtimeTransactions.filter((transaction) => (transaction.date ? String(transaction.date).slice(0, 10) : '') === todayKey);
  const todaysRealtimeAmount = todaysRealtimeTransactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const lastRealtimePayment = sessionRealtimePayments[0] || null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-1">
        <h1 className="page-header">Real-Time Payments</h1>
        <p className="page-description">Live feed of completed payments posted by reconciliation and 1BILL payment events.</p>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Payments Stream</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Last sync: {formatRealtimeTimestamp(lastLiveUpdateAt || liveClock.toISOString())}</span>
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
              <p className="text-[11px] text-muted-foreground">Session live payments</p>
              <p className="mt-1 text-xl font-semibold">{sessionRealtimePayments.length}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-[11px] text-muted-foreground">Collected today</p>
              <p className="mt-1 text-xl font-semibold text-success">{formatPKR(todaysRealtimeAmount)}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-[11px] text-muted-foreground">Today transactions</p>
              <p className="mt-1 text-xl font-semibold">{todaysRealtimeTransactions.length}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-[11px] text-muted-foreground">Most recent live payment</p>
              <p className="mt-1 text-sm font-semibold font-mono">{lastRealtimePayment?.transactionId || 'No live payment yet'}</p>
            </div>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Consumer #</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {realtimeTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                      No completed payment events yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  realtimeTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="text-xs text-muted-foreground">{formatRealtimeTimestamp(transaction.date)}</TableCell>
                      <TableCell className="font-mono text-xs">{transaction.transactionId}</TableCell>
                      <TableCell className="font-mono text-xs">{transaction.consumerNumber}</TableCell>
                      <TableCell className="font-semibold text-success">{formatPKR(transaction.amount)}</TableCell>
                      <TableCell>
                        {sessionLiveIds.has(transaction.id) ? (
                          <span className="inline-flex items-center rounded-md bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">Live</span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Historical</span>
                        )}
                      </TableCell>
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

export default RealTimePayments;
