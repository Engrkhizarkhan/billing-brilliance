import { QueryError } from '@/components/QueryError';
import { StatCard } from '@/components/StatCard';
import { DollarSign, TrendingUp, CreditCard, AlertTriangle, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { usePaymentStore } from '@/store/paymentStore';
import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
const CashFlow = () => {
  const paymentVersion = usePaymentStore((state) => state.version);
  const { data, loading, error } = useApiQuery(() => api.getPlatformAnalytics(), [paymentVersion]);
  const revenueData = useMemo(() => data?.revenueData || [], [data]);
  const monthlyTrendPercent = useMemo(() => {
    if (revenueData.length < 2) return 0;
    const current = revenueData[revenueData.length - 1].revenue;
    const previous = revenueData[revenueData.length - 2].revenue;
    if (!previous) return 0;
    return ((current - previous) / previous) * 100;
  }, [revenueData]);

  if (loading) return <p>Loading cash flow…</p>;
  if (error || !data) return <QueryError message={error || 'Report unavailable'} />;
  const summary = { ...data.totals, overduePayments: data.totals.overdueAmount };
  const { dailyData } = data;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Cash Flow</h1>
        <p className="page-description">Financial overview and daily cash movement</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Revenue Today" value={`₨ ${Math.round(summary.revenueToday).toLocaleString()}`} icon={DollarSign} trend="Net of reversals · UTC" trendUp />
        <StatCard title="Revenue This Month" value={`₨ ${Math.round(summary.revenueThisMonth).toLocaleString()}`} icon={TrendingUp} trend={`${Math.abs(monthlyTrendPercent).toFixed(1)}% vs last month`} trendUp={monthlyTrendPercent >= 0} />
        <StatCard title="Total Revenue" value={`₨ ${Math.round(summary.totalRevenue).toLocaleString()}`} icon={CreditCard} />
        <StatCard title="Overdue Payments" value={`₨ ${Math.round(summary.overduePayments).toLocaleString()}`} icon={AlertTriangle} trend="Outstanding invoice amount" trendUp={false} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Weekly Cash Flow</h3>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-success"><ArrowUpRight className="w-3 h-3" /> Inflow</span>
              <span className="flex items-center gap-1 text-destructive"><ArrowDownRight className="w-3 h-3" /> Reversed</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="day" fontSize={11} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
              <YAxis fontSize={11} tickFormatter={(v) => `${v / 1000}K`} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
              <Tooltip formatter={(v: number) => `₨ ${v.toLocaleString()}`} contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid hsl(220, 13%, 91%)' }} />
              <Area type="monotone" dataKey="inflow" stroke="hsl(160, 84%, 39%)" fill="url(#inflowGrad)" strokeWidth={2.5} />
              <Area type="monotone" dataKey="outflow" stroke="hsl(0, 72%, 51%)" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Monthly Revenue Trend</h3>
            <span className={monthlyTrendPercent >= 0 ? 'metric-change-up' : 'metric-change-down'}>
              {monthlyTrendPercent >= 0 ? '↑' : '↓'} {Math.abs(monthlyTrendPercent).toFixed(1)}%
            </span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="cashRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="month" fontSize={11} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
              <YAxis fontSize={11} tickFormatter={(v) => `${v / 1000}K`} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
              <Tooltip formatter={(v: number) => [`₨ ${v.toLocaleString()}`, 'Revenue']} contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid hsl(220, 13%, 91%)' }} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(221, 83%, 53%)" fill="url(#cashRevGrad)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default CashFlow;
