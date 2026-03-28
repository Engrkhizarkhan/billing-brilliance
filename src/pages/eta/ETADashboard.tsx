import { StatCard } from '@/components/StatCard';
import { Briefcase, UserPlus, Receipt, Wallet, Activity, TrendingUp } from 'lucide-react';
import { services, applicants, revenueData } from '@/data/mockData';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const ETADashboard = () => (
  <div className="space-y-6 animate-fade-in">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="page-header">Agency Dashboard</h1>
        <p className="page-description">Manage services, applicants, and payments</p>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Activity className="w-3.5 h-3.5 text-success" />
        <span>System online</span>
      </div>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard title="Active Services" value={services.filter(s => s.status === 'active').length} icon={Briefcase} />
      <StatCard title="Total Applicants" value={applicants.length} icon={UserPlus} trend="3 new this week" trendUp />
      <StatCard title="Pending Invoices" value="12" icon={Receipt} />
      <StatCard title="Collections" value="₨ 2.1M" icon={Wallet} trend="8% vs last month" trendUp />
    </div>

    <div className="dashboard-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title">Collection Trend</h3>
        <span className="metric-change-up">↑ 8%</span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={revenueData}>
          <defs>
            <linearGradient id="etaRevGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.15} />
              <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
          <XAxis dataKey="month" fontSize={11} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
          <YAxis fontSize={11} tickFormatter={(v) => `${v / 1000}K`} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
          <Tooltip formatter={(v: number) => [`₨ ${v.toLocaleString()}`, 'Collected']} contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid hsl(220, 13%, 91%)' }} />
          <Area type="monotone" dataKey="revenue" stroke="hsl(221, 83%, 53%)" fill="url(#etaRevGrad)" strokeWidth={2.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export default ETADashboard;
