import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { DollarSign, CreditCard, Clock, AlertTriangle, Building2, Ban, TrendingUp, Activity } from 'lucide-react';
import { billers, revenueData, paymentSuccessData, transactionVolumeData, transactions } from '@/data/mockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const AdminDashboard = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Dashboard</h1>
          <p className="page-description">Overview of your fintech billing platform</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="w-3.5 h-3.5 text-success" />
          <span>All systems operational</span>
          <span className="text-border">•</span>
          <span>Last sync: 2 min ago</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard title="Total Revenue" value="₨ 7.9M" icon={DollarSign} trend="12% vs last month" trendUp />
        <StatCard title="Total Payments" value="3,410" icon={CreditCard} trend="8% vs last month" trendUp />
        <StatCard title="Pending" value="₨ 1.2M" icon={Clock} />
        <StatCard title="Overdue" value="₨ 450K" icon={AlertTriangle} trend="3% increase" trendUp={false} />
        <StatCard title="Active Billers" value={billers.filter(b => b.status === 'active').length} icon={Building2} />
        <StatCard title="Banned Users" value="2" icon={Ban} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Monthly Revenue</h3>
            <span className="metric-change-up">↑ 12%</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="month" fontSize={11} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
              <YAxis fontSize={11} tickFormatter={(v) => `${v / 1000}K`} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
              <Tooltip formatter={(v: number) => [`₨ ${v.toLocaleString()}`, 'Revenue']} contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid hsl(220, 13%, 91%)' }} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(221, 83%, 53%)" fill="url(#revGrad)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Payment Success Rate</h3>
            <span className="metric-change-up">↑ 93%</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={paymentSuccessData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="month" fontSize={11} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
              <YAxis fontSize={11} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
              <Tooltip contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid hsl(220, 13%, 91%)' }} />
              <Bar dataKey="success" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="failed" fill="hsl(0, 72%, 85%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Transaction Volume</h3>
            <span className="metric-change-up">↑ 680</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={transactionVolumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="month" fontSize={11} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
              <YAxis fontSize={11} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
              <Tooltip contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid hsl(220, 13%, 91%)' }} />
              <Line type="monotone" dataKey="volume" stroke="hsl(271, 55%, 55%)" strokeWidth={2.5} dot={{ r: 4, fill: 'hsl(271, 55%, 55%)', strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="table-container">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="section-title">Recent Transactions</h3>
          <span className="text-[11px] text-muted-foreground">{transactions.length} total</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-semibold">Transaction ID</TableHead>
              <TableHead className="text-xs font-semibold">Consumer Number</TableHead>
              <TableHead className="text-xs font-semibold">Biller</TableHead>
              <TableHead className="text-xs font-semibold">Amount</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="text-xs font-semibold">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.slice(0, 5).map((t) => (
              <TableRow key={t.id} className="hover:bg-muted/30">
                <TableCell className="font-mono text-xs">{t.transactionId}</TableCell>
                <TableCell className="font-mono text-[11px] text-muted-foreground">{t.consumerNumber}</TableCell>
                <TableCell className="text-sm">{t.billerName}</TableCell>
                <TableCell className="font-mono text-sm">₨ {t.amount.toLocaleString()}</TableCell>
                <TableCell><StatusBadge status={t.status} /></TableCell>
                <TableCell className="text-sm text-muted-foreground">{t.date}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminDashboard;
