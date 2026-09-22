import { QueryError } from '@/components/QueryError';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { DollarSign, CreditCard, AlertTriangle, Building2, Activity, Shield, FileText, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePaymentStore } from '@/store/paymentStore';
import { useMemo, useState } from 'react';
import { TablePagination } from '@/components/TablePagination';
const AdminDashboard = () => {
  const paymentVersion = usePaymentStore((state) => state.version);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { data, loading, error, meta } = useApiQuery(() => api.getPlatformAnalytics(page, pageSize), [paymentVersion, page, pageSize]);
  const { data: recentTransactions = [], error: transactionError } = useApiQuery(() => api.fetchTransactions({ pageSize: 5 }), [paymentVersion]);
  const revenueData = useMemo(() => data?.revenueData || [], [data]);
  const paymentSuccessData = useMemo(() => data?.paymentSuccessData || [], [data]);
  const transactionVolumeData = useMemo(() => data?.transactionVolumeData || [], [data]);
  const revenueTrendPercent = useMemo(() => {
    if (revenueData.length < 2) return 0;
    const current = revenueData[revenueData.length - 1].revenue;
    const previous = revenueData[revenueData.length - 2].revenue;
    if (!previous) return 0;
    return ((current - previous) / previous) * 100;
  }, [revenueData]);

  const latestSuccessRate = useMemo(() => {
    if (paymentSuccessData.length === 0) return 0;
    const latest = paymentSuccessData[paymentSuccessData.length - 1];
    const total = latest.success + latest.failed;
    if (!total) return 0;
    return Math.round((latest.success / total) * 100);
  }, [paymentSuccessData]);

  const txnGrowth = useMemo(() => {
    if (transactionVolumeData.length < 2) return 0;
    return transactionVolumeData[transactionVolumeData.length - 1].volume - transactionVolumeData[transactionVolumeData.length - 2].volume;
  }, [transactionVolumeData]);

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  if (error || transactionError || !data) return <QueryError message={error || transactionError || 'Dashboard unavailable'} />;
  const { totals, tenantSummary } = data;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Dashboard</h1>
          <p className="page-description">Multi-tenant control plane for schools on the platform</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="w-3.5 h-3.5 text-success" />
          <span>Reporting in UTC</span>
          <span className="text-border">•</span>
          <span>Refreshes after payment updates</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard title="Tenants" value={totals.tenants.toString()} icon={Building2} trend={`${totals.activeTenants} active`} trendUp />
        <StatCard title="Students" value={totals.students.toString()} icon={Shield} trend="Across all tenants" trendUp />
        <StatCard title="Invoices" value={totals.invoices.toString()} icon={FileText} trend="Cross-tenant" trendUp />
        <StatCard title="Total Revenue" value={`₨ ${Math.round(totals.totalRevenue).toLocaleString()}`} icon={DollarSign} trend={`${Math.abs(revenueTrendPercent).toFixed(1)}% vs last month`} trendUp={revenueTrendPercent >= 0} />
        <StatCard title="Total Payments" value={totals.totalPayments.toLocaleString()} icon={CreditCard} trend="Completed transactions" trendUp />
        <StatCard title="Overdue" value={`₨ ${Math.round(totals.overdueAmount).toLocaleString()}`} icon={AlertTriangle} trend={`Pending: ₨ ${Math.round(totals.pendingAmount).toLocaleString()}`} trendUp={false} />
      </div>

      <div className="dashboard-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title">Tenant health</h3>
          <span className="text-[11px] text-muted-foreground">{totals.tenants} tenants • {totals.students} students</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Tenant</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs">Code</TableHead>
              <TableHead className="text-xs">Students</TableHead>
              <TableHead className="text-xs">Invoices</TableHead>
              <TableHead className="text-xs">Txns</TableHead>
              <TableHead className="text-xs">Paid Revenue</TableHead>
              <TableHead className="text-xs">Pending</TableHead>
              <TableHead className="text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenantSummary.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell className="font-medium">{tenant.name}</TableCell>
                <TableCell className="capitalize text-sm">{tenant.type.replace('_', ' ')}</TableCell>
                <TableCell className="font-mono text-xs">{tenant.billerCode}</TableCell>
                <TableCell className="font-mono text-sm">{tenant.studentCount}</TableCell>
                <TableCell className="font-mono text-sm">{tenant.invoiceCount}</TableCell>
                <TableCell className="font-mono text-sm">{tenant.txnCount}</TableCell>
                <TableCell className="font-mono text-sm">₨ {tenant.revenue.toLocaleString()}</TableCell>
                <TableCell className="font-mono text-sm text-amber-600">₨ {tenant.pendingAmount.toLocaleString()}</TableCell>
                <TableCell><StatusBadge status={tenant.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination total={meta?.total || 0} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Monthly Revenue</h3>
            <span className={revenueTrendPercent >= 0 ? 'metric-change-up' : 'metric-change-down'}>
              {revenueTrendPercent >= 0 ? '↑' : '↓'} {Math.abs(revenueTrendPercent).toFixed(1)}%
            </span>
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
            <span className="metric-change-up">{latestSuccessRate}%</span>
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
            <span className={txnGrowth >= 0 ? 'metric-change-up' : 'metric-change-down'}>
              {txnGrowth >= 0 ? '↑' : '↓'} {Math.abs(txnGrowth)}
            </span>
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
          <span className="text-[11px] text-muted-foreground">{totals.totalTransactions} total</span>
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
            {(recentTransactions || []).map((t) => (
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
