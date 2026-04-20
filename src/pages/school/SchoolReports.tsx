import { useMemo } from 'react';
import { StatCard } from '@/components/StatCard';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import type { Student, Invoice } from '@/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Wallet, AlertTriangle, BarChart3, Receipt, Loader2 } from 'lucide-react';
import { formatPKR } from '@/lib/formatters';

const CHART_COLORS = ['hsl(221, 83%, 53%)', 'hsl(160, 84%, 39%)', 'hsl(38, 92%, 50%)', 'hsl(271, 55%, 55%)', 'hsl(0, 72%, 51%)'];

const SchoolReports = () => {
  const { data: studentsData, loading: ls } = useApiQuery(() => api.fetchStudents({ pageSize: 9999 }), []);
  const { data: invoicesData, loading: li } = useApiQuery(() => api.fetchInvoices({ pageSize: 9999 }), []);
  const { data: statsData, loading: lStats } = useApiQuery(() => api.getDashboardStats(), []);
  const { data: monthlyTrendData, loading: lTrend } = useApiQuery(() => api.getMonthlyTrend(), []);
  const { data: feeByPlanData, loading: lFee } = useApiQuery(() => api.getCollectionByFeePlan(), []);

  const students = useMemo(() => (studentsData || []) as Student[], [studentsData]);
  const invoices = useMemo(() => (invoicesData || []) as Invoice[], [invoicesData]);
  const stats = statsData as { paidRevenue?: number; overdueInvoices?: number } | null;
  const monthlyTrend = (monthlyTrendData || []) as { month: string; collected: number }[];
  const feeByPlan = (feeByPlanData || []) as { name: string; value: number }[];

  const loading = ls || li || lStats || lTrend || lFee;

  const invoiceStatusData = useMemo(() => [
    { status: 'Paid', count: invoices.filter((invoice) => invoice.status === 'paid').length },
    { status: 'Pending', count: invoices.filter((invoice) => invoice.status === 'pending').length },
    { status: 'Overdue', count: invoices.filter((invoice) => invoice.status === 'overdue').length },
  ], [invoices]);

  const totalCollected = stats?.paidRevenue ?? 0;
  const paidInvoiceCount = invoices.filter((invoice) => invoice.status === 'paid').length;
  const pendingInvoiceCount = invoices.filter((invoice) => invoice.status === 'pending').length;
  const overdueCount = stats?.overdueInvoices ?? invoices.filter((invoice) => invoice.status === 'overdue').length;

  const defaultersByClass = useMemo(() => {
    const classMap: Record<string, number> = {};
    students.forEach((student) => {
      const due = invoices.filter((inv) => inv.consumerNumber === student.consumerNumber && (inv.status === 'overdue' || inv.status === 'pending')).reduce((sum, inv) => sum + inv.amount, 0);
      if (due > 0) classMap[student.class] = (classMap[student.class] || 0) + 1;
    });

    return Object.entries(classMap)
      .map(([className, count]) => ({ className: className.replace('Class ', 'C'), count }))
      .sort((a, b) => a.className.localeCompare(b.className));
  }, [students, invoices]);

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Reports</h1>
        <p className="page-description">School analytics and collection performance reports</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Collected" value={formatPKR(totalCollected)} icon={Wallet} trend="Across selected report period" trendUp />
        <StatCard title="Paid Invoices" value={paidInvoiceCount} icon={BarChart3} trend="Invoices settled" trendUp />
        <StatCard title="Pending Invoices" value={pendingInvoiceCount} icon={Receipt} trend="Awaiting payment" />
        <StatCard title="Overdue Invoices" value={overdueCount} icon={AlertTriangle} trend="Requires follow-up" trendUp={false} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="dashboard-card">
          <h3 className="font-semibold mb-4">Monthly Collection Trend</h3>
          {monthlyTrend.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">No payment data available yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `${v / 1000}K`} />
                <Tooltip formatter={(v: number) => [formatPKR(v), 'Amount']} />
                <Bar dataKey="collected" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} name="Collected" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="dashboard-card">
          <h3 className="font-semibold mb-4">Collection by Fee Plan</h3>
          {feeByPlan.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">No fee plans configured.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={feeByPlan}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={105}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {feeByPlan.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatPKR(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="dashboard-card">
          <h3 className="font-semibold mb-4">Invoice Status Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={invoiceStatusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
              <XAxis dataKey="status" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {invoiceStatusData.map((_, index) => (
                  <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="dashboard-card">
          <h3 className="font-semibold mb-4">Defaulters by Class</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={defaultersByClass}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
              <XAxis dataKey="className" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="hsl(0, 72%, 51%)" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="dashboard-card">
        <h3 className="font-semibold mb-4">Monthly Revenue Trend</h3>
        {monthlyTrend.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">No payment data available yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v) => `${v / 1000}K`} />
              <Tooltip formatter={(v: number) => [formatPKR(v), 'Revenue']} />
              <Line type="monotone" dataKey="collected" stroke="hsl(160, 84%, 39%)" strokeWidth={2.5} dot={{ r: 4 }} name="Revenue" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default SchoolReports;
