import { StatCard } from '@/components/StatCard';
import { Receipt, Wallet, Activity, CheckCircle2, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatPKR } from '@/lib/formatters';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { usePaymentStore } from '@/store/paymentStore';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { OrgPaymentRecord } from '@/types';

const OrgDashboard = () => {
  const navigate = useNavigate();
  const paymentVersion = usePaymentStore((state) => state.version);

  const { data: paymentsData, loading: loadingPayments } = useApiQuery(() => api.listOrgPayments(), [paymentVersion]);
  const paymentRecords = useMemo(() => (paymentsData || []) as OrgPaymentRecord[], [paymentsData]);

  const pipelineData = useMemo(
    () => [
      { stage: 'Pending', count: paymentRecords.filter((p) => p.status === 'pending').length },
      { stage: 'Paid', count: paymentRecords.filter((p) => p.status === 'paid').length },
      {
        stage: 'Failed/Expired',
        count: paymentRecords.filter((p) => p.status === 'failed' || p.status === 'expired').length,
      },
    ],
    [paymentRecords]
  );

  const collectionTrend = useMemo(() => {
    const byMonth = new Map<string, number>();
    paymentRecords
      .filter((p) => p.status === 'paid')
      .forEach((p) => {
        const sourceDate = (p.paidAt || p.createdAt).slice(0, 7);
        byMonth.set(sourceDate, (byMonth.get(sourceDate) || 0) + Number(p.amount));
      });
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => {
        const [year, monthNum] = month.split('-').map(Number);
        const label = new Date(year, monthNum - 1, 1).toLocaleDateString('en-US', { month: 'short' });
        return { month: label, revenue };
      });
  }, [paymentRecords]);

  const feeCollected = paymentRecords
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const pendingPayments = paymentRecords.filter((p) => p.status === 'pending').length;
  const verifiedTransactions = paymentRecords.filter((p) => p.status === 'paid' && p.transactionId).length;

  if (loadingPayments) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Dashboard</h1>
          <p className="page-description">Overview of payment processing. Applicant data is managed by your organization's core system.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="w-3.5 h-3.5 text-success" />
          <span>System online</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="cursor-pointer" onClick={() => navigate('/org/payments')}>
          <StatCard title="Payment Requests" value={paymentRecords.length} icon={Receipt} />
        </div>
        <StatCard title="Fees Collected" value={formatPKR(feeCollected)} icon={Wallet} trend="Paid payment records" trendUp={feeCollected > 0} />
        <StatCard title="Pending Payments" value={pendingPayments} icon={Receipt} trend="Requests awaiting callback" trendUp={false} />
        <StatCard title="Verified Transactions" value={verifiedTransactions} icon={CheckCircle2} trend="Callback confirmed" trendUp />
      </div>

      <div className="dashboard-card">
        <h3 className="section-title mb-4">Payment Status Pipeline</h3>
        <div className="space-y-3 mt-2">
          {pipelineData.map((stage, i) => {
            const maxCount = Math.max(...pipelineData.map((item) => item.count), 1);
            const pct = (stage.count / maxCount) * 100;
            const colors = ['bg-warning', 'bg-success', 'bg-destructive'];
            return (
              <div key={stage.stage} className="flex items-center gap-3">
                <span className="text-xs font-medium w-24 text-right text-muted-foreground">{stage.stage}</span>
                <div className="flex-1 h-8 bg-muted/50 rounded-lg overflow-hidden">
                  <div className={`${colors[i]} h-full rounded-lg flex items-center px-3 transition-all`} style={{ width: `${Math.max(pct, 10)}%` }}>
                    <span className="text-xs font-bold text-white">{stage.count}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="dashboard-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title">Fee Collection Trend</h3>
          <span className="metric-change-up">Based on paid payment records</span>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={collectionTrend}>
            <defs>
              <linearGradient id="orgRevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
            <XAxis dataKey="month" fontSize={11} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
            <YAxis fontSize={11} tickFormatter={(value) => `${value / 1000}K`} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
            <Tooltip formatter={(value: number) => [formatPKR(value), 'Collected']} contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid hsl(220, 13%, 91%)' }} />
            <Area type="monotone" dataKey="revenue" stroke="hsl(221, 83%, 53%)" fill="url(#orgRevGrad)" strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default OrgDashboard;
