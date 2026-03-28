import { StatCard } from '@/components/StatCard';
import { DollarSign, TrendingUp, CreditCard, AlertTriangle, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { revenueData } from '@/data/mockData';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const dailyData = [
  { day: 'Mon', inflow: 180000, outflow: 45000 },
  { day: 'Tue', inflow: 220000, outflow: 52000 },
  { day: 'Wed', inflow: 195000, outflow: 38000 },
  { day: 'Thu', inflow: 280000, outflow: 61000 },
  { day: 'Fri', inflow: 310000, outflow: 48000 },
  { day: 'Sat', inflow: 150000, outflow: 22000 },
  { day: 'Sun', inflow: 90000, outflow: 15000 },
];

const CashFlow = () => (
  <div className="space-y-6 animate-fade-in">
    <div>
      <h1 className="page-header">Cash Flow</h1>
      <p className="page-description">Financial overview and daily cash movement</p>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard title="Revenue Today" value="₨ 125,000" icon={DollarSign} trend="15% vs yesterday" trendUp />
      <StatCard title="Revenue This Month" value="₨ 1,250,000" icon={TrendingUp} trend="12% vs last month" trendUp />
      <StatCard title="Total Payments" value="₨ 7,900,000" icon={CreditCard} />
      <StatCard title="Overdue Payments" value="₨ 450,000" icon={AlertTriangle} trend="3% increase" trendUp={false} />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="dashboard-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title">Weekly Cash Flow</h3>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1 text-success"><ArrowUpRight className="w-3 h-3" /> Inflow</span>
            <span className="flex items-center gap-1 text-destructive"><ArrowDownRight className="w-3 h-3" /> Outflow</span>
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
          <span className="metric-change-up">↑ 12%</span>
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

export default CashFlow;
