import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { usePaymentStore } from '@/store/paymentStore';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/EmptyState';
import { Activity, CreditCard, RefreshCw, TrendingUp, Zap } from 'lucide-react';
import { formatPKR } from '@/lib/formatters';

const CHANNEL_LABEL: Record<string, string> = {
  bank_app: 'Bank App',
  jazzcash: 'JazzCash',
  easypaisa: 'Easypaisa',
  atm: 'ATM',
  counter: 'Bank Counter',
  cash_offline: 'Cash / Offline',
};

const formatTs = (value: string) => {
  const normalized = value.includes('T') ? value : `${value}T00:00:00`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const RealTimePayments = () => {
  const paymentVersion = usePaymentStore((state) => state.version);
  const sessionStartRef = useRef(new Date());

  // ---- Live feed state ----
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [liveClock, setLiveClock] = useState(() => new Date());
  const [lastSyncAt, setLastSyncAt] = useState<Date>(() => new Date());

  const { data: txnData, refetch: refetchTxns } = useApiQuery(
    () => api.fetchTransactions({ pageSize: 50, status: 'completed' } as Parameters<typeof api.fetchTransactions>[0]),
    [paymentVersion]
  );
  const transactions = (txnData || []) as Array<{
    id: string; transactionId: string; consumerNumber: string; amount: number;
    status: string; date: string; channel?: string; billerName: string; createdAt?: string;
  }>;

  // Auto-refresh every 10 s when enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      setLiveClock(new Date());
      setLastSyncAt(new Date());
      void refetchTxns();
    }, 10000);
    return () => window.clearInterval(id);
  }, [autoRefresh, refetchTxns]);

  useEffect(() => {
    if (paymentVersion === 0) return;
    setLiveClock(new Date());
    setLastSyncAt(new Date());
  }, [paymentVersion]);

  const todayKey = liveClock.toISOString().slice(0, 10);

  const sessionLiveIds = useMemo(
    () => new Set(transactions.filter((t) => t.createdAt && new Date(t.createdAt) >= sessionStartRef.current).map((t) => t.id)),
    [transactions]
  );
  const todayTxns = useMemo(() => transactions.filter((t) => String(t.date).slice(0, 10) === todayKey), [transactions, todayKey]);
  const todayAmount = todayTxns.reduce((s, t) => s + Number(t.amount), 0);
  const sessionCount = sessionLiveIds.size;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Real-Time Payments</h1>
          <p className="page-description">Live feed of completed payment events, auto-refreshed every 10 seconds.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-lg gap-1.5"
          onClick={() => { setAutoRefresh((v) => !v); if (!autoRefresh) void refetchTxns(); }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} />
          {autoRefresh ? 'Auto-refresh On' : 'Auto-refresh Off'}
        </Button>
      </div>

      {/* Live stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="dashboard-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-success" /></div>
          <div><p className="stat-label">Collected Today</p><p className="text-lg font-bold text-success">{formatPKR(todayAmount)}</p></div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><CreditCard className="w-5 h-5 text-primary" /></div>
          <div><p className="stat-label">Transactions Today</p><p className="text-lg font-bold">{todayTxns.length}</p></div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Zap className="w-5 h-5 text-primary" /></div>
          <div><p className="stat-label">This Session</p><p className="text-lg font-bold">{sessionCount} payment{sessionCount !== 1 ? 's' : ''}</p></div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center"><Activity className="w-5 h-5 text-muted-foreground" /></div>
          <div>
            <p className="stat-label">Last sync</p>
            <p className="text-sm font-medium">{lastSyncAt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
          </div>
        </div>
      </div>

      {/* Live transaction feed */}
      <div className="table-container">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <p className="text-sm font-semibold flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${autoRefresh ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
            Live Transaction Feed
            <span className="text-muted-foreground font-normal text-xs ml-1">({transactions.length} recent)</span>
          </p>
          <Button variant="ghost" size="sm" className="rounded-lg gap-1.5 text-xs" onClick={() => void refetchTxns()}>
            <RefreshCw className="w-3 h-3" />Refresh
          </Button>
        </div>
        {transactions.length === 0 ? (
          <EmptyState icon={Activity} title="No transactions yet" description="Completed payment events will appear here in real time." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Time</TableHead>
                <TableHead className="text-xs font-semibold">Transaction ID</TableHead>
                <TableHead className="text-xs font-semibold">Consumer #</TableHead>
                <TableHead className="text-xs font-semibold">Channel</TableHead>
                <TableHead className="text-xs font-semibold text-right">Amount</TableHead>
                <TableHead className="text-xs font-semibold">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => {
                const isLive = sessionLiveIds.has(t.id);
                return (
                  <TableRow key={t.id} className={`hover:bg-muted/30 ${isLive ? 'bg-success/5' : ''}`}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatTs(t.date)}</TableCell>
                    <TableCell className="font-mono text-xs">{t.transactionId}</TableCell>
                    <TableCell className="font-mono text-xs">{t.consumerNumber}</TableCell>
                    <TableCell className="text-xs">{CHANNEL_LABEL[t.channel ?? ''] || t.channel || '—'}</TableCell>
                    <TableCell className="font-mono text-sm font-semibold text-success text-right">{formatPKR(t.amount)}</TableCell>
                    <TableCell>
                      {isLive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />Live
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Historical</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default RealTimePayments;

