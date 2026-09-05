import { useNavigate } from 'react-router-dom';
import { Activity, CheckCircle2, Code2, Receipt, Wallet } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatPKR } from '@/lib/formatters';
import { useApiQuery } from '@/hooks/useApiQuery';

const emptyStats = {
  totalRequests: 0,
  pending: 0,
  paid: 0,
  expired: 0,
  failed: 0,
  feeCollected: 0,
  verifiedTransactions: 0,
  collectionTrend: [] as { month: string; revenue: number }[],
};

const OrgDashboard = () => {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApiQuery(() => api.getOrgStats(), []);
  const stats = data || emptyStats;
  const pipeline = [
    { label: 'Pending', value: stats.pending, color: 'bg-warning' },
    { label: 'Paid', value: stats.paid, color: 'bg-success' },
    { label: 'Failed', value: stats.failed, color: 'bg-destructive' },
    { label: 'Expired', value: stats.expired, color: 'bg-muted-foreground' },
  ];
  const maxPipelineValue = Math.max(...pipeline.map((item) => item.value), 1);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-header">Organization Dashboard</h1>
          <p className="page-description">Monitor invoice-based payment requests, collections, and callback verification.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className={`h-3.5 w-3.5 ${error ? 'text-destructive' : 'text-success'}`} />
            {loading ? 'Loading metrics' : error ? 'Metrics unavailable' : 'System online'}
          </div>
          {error && <Button size="sm" variant="outline" onClick={() => void refetch()}>Retry</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <button className="text-left" onClick={() => navigate('/org/payments')}>
          <StatCard title="Payment Requests" value={stats.totalRequests} icon={Receipt} />
        </button>
        <StatCard title="Fees Collected" value={formatPKR(stats.feeCollected)} icon={Wallet} trend="Settled payment records" trendUp={stats.feeCollected > 0} />
        <button className="text-left" onClick={() => navigate('/org/history')}>
          <StatCard title="Pending Payments" value={stats.pending} icon={Receipt} trend="Awaiting payment confirmation" trendUp={false} />
        </button>
        <StatCard title="Verified Transactions" value={stats.verifiedTransactions} icon={CheckCircle2} trend="Transaction ID confirmed" trendUp />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.45fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment status pipeline</CardTitle>
            <CardDescription>Current state of all organization payment requests.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pipeline.map((stage) => (
              <div key={stage.label} className="space-y-1.5">
                <div className="flex justify-between text-xs"><span className="font-medium">{stage.label}</span><span className="text-muted-foreground">{stage.value}</span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${stage.color}`} style={{ width: `${stage.value === 0 ? 0 : Math.max((stage.value / maxPipelineValue) * 100, 8)}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div><CardTitle className="text-base">Collection trend</CardTitle><CardDescription>Paid payment value for the last 12 months.</CardDescription></div>
            <Button size="sm" variant="outline" onClick={() => navigate('/org/reports')}>Open reports</Button>
          </CardHeader>
          <CardContent>
            {stats.collectionTrend.length === 0 ? (
              <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">Collection activity will appear after payments are settled.</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={stats.collectionTrend}>
                  <defs><linearGradient id="orgCollectionGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} /><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `${Number(value) / 1000}K`} />
                  <Tooltip formatter={(value: number) => [formatPKR(value), 'Collected']} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#orgCollectionGradient)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3"><Code2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="font-semibold">Integrating from your own system?</p><p className="text-sm text-muted-foreground">Use the API Integration guide for authentication, payloads, responses, webhooks, and error handling.</p></div></div>
          <Button className="shrink-0" onClick={() => navigate('/org/api-integration')}>View API Integration</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrgDashboard;
