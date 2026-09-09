import { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { formatPKR } from '@/lib/formatters';
import { usePaymentStore } from '@/store/paymentStore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  paid: '#22c55e',
  pending: '#f59e0b',
  failed: '#ef4444',
  expired: '#6b7280',
};

const OrgReports = () => {
  const paymentVersion = usePaymentStore((state) => state.version);

  const { data: statsData, loading } = useApiQuery(() => api.getOrgStats(), [paymentVersion]);

  // ── Monthly collections (bar + line combined) ─────────────────────────────
  const monthlyCollections = useMemo(() => (statsData?.collectionTrend || []).map((row) => ({
    month: row.month, collected: Number(row.revenue), requests: Number(row.requests), failed: Number(row.failed),
  })), [statsData]);

  // ── Status distribution (pie) ─────────────────────────────────────────────
  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = statsData?.statusDistribution || {};
    return Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [statsData]);

  // ── Per-posting revenue (table + bar) ─────────────────────────────────────
  const postingRevenue = useMemo(() => statsData?.postingRevenue || [], [statsData]);

  // ── Top-line stats ────────────────────────────────────────────────────────
  const totalCollected = Number(statsData?.feeCollected || 0);
  const paidCount = Number(statsData?.paid || 0);
  const pendingCount = Number(statsData?.pending || 0);
  const failedExpiredCount = Number(statsData?.failed || 0) + Number(statsData?.expired || 0);
  const totalRequests = Number(statsData?.totalRequests || 0);
  const collectionRate = totalRequests > 0 ? Math.round((paidCount / totalRequests) * 100) : 0;
  const verifiedTransactions = Number(statsData?.verifiedTransactions || 0);
  const pendingValue = Number(statsData?.pendingValue || 0);
  const avgPayment = paidCount > 0 ? totalCollected / paidCount : 0;

  // ── Month-over-month growth ───────────────────────────────────────────────
  const growth = useMemo(() => {
    if (monthlyCollections.length < 2) return null;
    const last = monthlyCollections[monthlyCollections.length - 1];
    const prev = monthlyCollections[monthlyCollections.length - 2];
    if (!prev.collected) return null;
    return Math.round(((last.collected - prev.collected) / prev.collected) * 100);
  }, [monthlyCollections]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Reports</h1>
        <p className="page-description">Payment analytics and collection performance for your organization.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="dashboard-card">
          <p className="stat-label">Total Collected</p>
          <p className="text-xl font-bold">{formatPKR(totalCollected)}</p>
          {growth !== null && (
            <p className={`text-xs mt-1 flex items-center gap-1 ${growth >= 0 ? 'text-success' : 'text-destructive'}`}>
              {growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(growth)}% vs last month
            </p>
          )}
        </div>
        <div className="dashboard-card">
          <p className="stat-label">Paid Requests</p>
          <p className="text-xl font-bold">{paidCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Collection rate: {collectionRate}%</p>
        </div>
        <div className="dashboard-card">
          <p className="stat-label">Pending Value</p>
          <p className="text-xl font-bold text-warning">{formatPKR(pendingValue)}</p>
          <p className="text-xs text-muted-foreground mt-1">{pendingCount} outstanding requests</p>
        </div>
        <div className="dashboard-card">
          <p className="stat-label">Avg Payment</p>
          <p className="text-xl font-bold">{formatPKR(avgPayment)}</p>
          <p className="text-xs text-muted-foreground mt-1">{verifiedTransactions} verified · {failedExpiredCount} failed/expired</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown by Posting</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ─────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-5">
          <div className="dashboard-card">
            <h3 className="font-semibold mb-4">Monthly Collections</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyCollections}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `${v / 1000}K`} />
                <Tooltip formatter={(value: number, name: string) => [name === 'collected' ? formatPKR(value) : value, name === 'collected' ? 'Collected' : 'Requests']} />
                <Bar dataKey="collected" fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} name="collected" />
                <Bar dataKey="failed" fill="#ef4444" radius={[4, 4, 0, 0]} name="failed" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="dashboard-card">
              <h3 className="font-semibold mb-4">Status Distribution</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={statusDistribution} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={12}>
                    {statusDistribution.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#8b5cf6'} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="dashboard-card">
              <h3 className="font-semibold mb-4">Request Volume Trend</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={monthlyCollections}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="requests" stroke="hsl(221, 83%, 53%)" strokeWidth={2} dot={{ r: 4 }} name="Requests" />
                  <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Failed/Expired" strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Summary quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border bg-success/5 p-3 text-center">
              <p className="text-xs text-muted-foreground">Collection Rate</p>
              <p className="text-2xl font-bold text-success">{collectionRate}%</p>
            </div>
            <div className="rounded-lg border bg-blue-500/5 p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Requests</p>
              <p className="text-2xl font-bold">{totalRequests}</p>
            </div>
            <div className="rounded-lg border bg-warning/5 p-3 text-center">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-warning">{pendingCount}</p>
            </div>
            <div className="rounded-lg border bg-destructive/5 p-3 text-center">
              <p className="text-xs text-muted-foreground">Failed / Expired</p>
              <p className="text-2xl font-bold text-destructive">{failedExpiredCount}</p>
            </div>
          </div>
        </TabsContent>

        {/* ── Breakdown Tab ─────────────────────────────────────── */}
        <TabsContent value="breakdown" className="space-y-5">
          <div className="dashboard-card">
            <h3 className="font-semibold mb-4">Revenue by Posting</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={postingRevenue} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                <XAxis type="number" fontSize={12} tickFormatter={(v) => `${v / 1000}K`} />
                <YAxis type="category" dataKey="posting" fontSize={11} width={160} />
                <Tooltip formatter={(value: number) => [formatPKR(value), 'Collected']} />
                <Bar dataKey="collected" fill="hsl(221, 83%, 53%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Posting</TableHead>
                  <TableHead className="text-right">Total Requests</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Failed / Expired</TableHead>
                  <TableHead className="text-right">Avg Payment</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {postingRevenue.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">No posting revenue available yet.</TableCell>
                  </TableRow>
                ) : (
                  postingRevenue.map((row) => {
                    const rate = row.totalRequests > 0 ? Math.round((row.paidRequests / row.totalRequests) * 100) : 0;
                    return (
                      <TableRow key={row.posting}>
                        <TableCell className="font-medium text-sm">{row.posting}</TableCell>
                        <TableCell className="font-mono text-sm text-right">{row.totalRequests}</TableCell>
                        <TableCell className="font-mono text-sm text-right text-success">{row.paidRequests}</TableCell>
                        <TableCell className="font-mono text-sm text-right text-warning">{row.pendingRequests}</TableCell>
                        <TableCell className="font-mono text-sm text-right text-destructive">{row.failedRequests}</TableCell>
                        <TableCell className="font-mono text-sm text-right">{formatPKR(row.avgAmount)}</TableCell>
                        <TableCell className="font-mono text-sm text-right font-semibold">{formatPKR(row.collected)}</TableCell>
                        <TableCell className="text-right">
                          <span className={`inline-flex items-center gap-1 text-xs font-mono font-semibold ${rate >= 70 ? 'text-success' : rate >= 40 ? 'text-warning' : 'text-destructive'}`}>
                            {rate >= 70 ? <TrendingUp className="w-3 h-3" /> : rate >= 40 ? <Minus className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {rate}%
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrgReports;
