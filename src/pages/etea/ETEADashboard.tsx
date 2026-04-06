import { StatCard } from '@/components/StatCard';
import { Receipt, Wallet, Activity, Megaphone, CheckCircle2 } from 'lucide-react';
import { eteaPostings } from '@/data/mockData';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { formatPKR } from '@/lib/formatters';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { resolvePostingById } from '@/lib/eteaFinance';
import { usePaymentStore } from '@/store/paymentStore';
import { listPayments } from '@/services/eteaPaymentController';

const ETEADashboard = () => {
  const navigate = useNavigate();
  const paymentVersion = usePaymentStore((state) => state.version);

  const paymentRecords = useMemo(() => listPayments(), [paymentVersion]);

  const pipelineData = useMemo(
    () => [
      { stage: 'Pending', count: paymentRecords.filter((payment) => payment.status === 'pending').length },
      { stage: 'Paid', count: paymentRecords.filter((payment) => payment.status === 'paid').length },
      {
        stage: 'Failed/Expired',
        count: paymentRecords.filter((payment) => payment.status === 'failed' || payment.status === 'expired').length,
      },
    ],
    [paymentRecords]
  );

  const requestsPerPosting = useMemo(() => {
    const postingMap = new Map<string, { name: string; requests: number }>();

    paymentRecords.forEach((payment) => {
      const posting = resolvePostingById(payment.postingId);
      const key = posting.id;
      const current = postingMap.get(key);
      if (current) {
        current.requests += 1;
        return;
      }
      postingMap.set(key, {
        name: posting.title.length > 18 ? `${posting.title.slice(0, 18)}...` : posting.title,
        requests: 1,
      });
    });

    return Array.from(postingMap.values()).sort((a, b) => b.requests - a.requests);
  }, [paymentRecords]);

  const collectionTrend = useMemo(() => {
    const byMonth = new Map<string, number>();

    paymentRecords
      .filter((payment) => payment.status === 'paid')
      .forEach((payment) => {
        const sourceDate = (payment.paidAt || payment.createdAt).slice(0, 7);
        const current = byMonth.get(sourceDate) || 0;
        byMonth.set(sourceDate, current + payment.amount);
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
    .filter((payment) => payment.status === 'paid')
    .reduce((sum, payment) => sum + payment.amount, 0);

  const pendingPayments = paymentRecords.filter((payment) => payment.status === 'pending').length;
  const verifiedTransactions = paymentRecords.filter((payment) => payment.status === 'paid' && payment.transactionId).length;
  const activePostings = eteaPostings.filter((posting) => posting.status === 'active').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">ETEA Dashboard</h1>
          <p className="page-description">Manage postings and payment processing. Applicant master data remains with the source ETEA system.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="w-3.5 h-3.5 text-success" />
          <span>System online</span>
        </div>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
        This portal acts as a payment processor. It should keep application references and temporary payment records only, not student master ownership.
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="cursor-pointer" onClick={() => navigate('/etea/postings')}><StatCard title="Active Postings" value={activePostings} icon={Megaphone} /></div>
        <div className="cursor-pointer" onClick={() => navigate('/etea/payments')}><StatCard title="Payment Requests" value={paymentRecords.length} icon={Receipt} /></div>
        <StatCard title="Fees Collected" value={formatPKR(feeCollected)} icon={Wallet} trend="Paid payment records" trendUp={feeCollected > 0} />
        <StatCard title="Pending Payments" value={pendingPayments} icon={Receipt} trend="Requests awaiting callback" trendUp={false} />
        <StatCard title="Verified Transactions" value={verifiedTransactions} icon={CheckCircle2} trend="Callback confirmed transactions" trendUp />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="dashboard-card">
          <h3 className="section-title mb-4">Requests Per Posting</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={requestsPerPosting} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis type="number" fontSize={11} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
              <YAxis dataKey="name" type="category" fontSize={11} width={120} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
              <Tooltip contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid hsl(220, 13%, 91%)' }} />
              <Bar dataKey="requests" fill="hsl(221, 83%, 53%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
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
      </div>

      <div className="dashboard-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title">Fee Collection Trend</h3>
          <span className="metric-change-up">Based on paid payment records</span>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={collectionTrend}>
            <defs>
              <linearGradient id="eteaRevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
            <XAxis dataKey="month" fontSize={11} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
            <YAxis fontSize={11} tickFormatter={(value) => `${value / 1000}K`} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
            <Tooltip formatter={(value: number) => [formatPKR(value), 'Collected']} contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid hsl(220, 13%, 91%)' }} />
            <Area type="monotone" dataKey="revenue" stroke="hsl(221, 83%, 53%)" fill="url(#eteaRevGrad)" strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ETEADashboard;
