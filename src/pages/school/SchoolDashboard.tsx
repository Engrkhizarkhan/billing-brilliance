import { StatCard } from '@/components/StatCard';
import { GraduationCap, Receipt, Wallet, Users, AlertTriangle, Calendar, TrendingUp, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import { useMemo } from 'react';
import { formatPKR } from '@/lib/formatters';
import { useNavigate } from 'react-router-dom';
import { usePaymentStore } from '@/store/paymentStore';

const CHART_COLORS = ['hsl(221, 83%, 53%)', 'hsl(160, 84%, 39%)', 'hsl(38, 92%, 50%)', 'hsl(271, 55%, 55%)', 'hsl(0, 72%, 51%)'];

const SchoolDashboard = () => {
  const navigate = useNavigate();
  const paymentVersion = usePaymentStore((state) => state.version);

  const { data: paymentHistoryData, loading: lp } = useApiQuery(() => api.fetchPaymentHistory({ pageSize: 5 }), [paymentVersion]);
  const { data: feeByPlanData, loading: lFee } = useApiQuery(() => api.getCollectionByFeePlan(), [paymentVersion]);
  const { data: monthlyTrendData, loading: lTrend } = useApiQuery(() => api.getMonthlyTrend(), [paymentVersion]);
  const { data: dashStatsData, loading: lStats } = useApiQuery(() => api.getDashboardStats(), [paymentVersion]);

  const paymentHistory = useMemo(() => (paymentHistoryData || []) as Array<{ id: string; studentName: string; amount: number; date: string; note: string }>, [paymentHistoryData]);
  const feeByPlan = (feeByPlanData || []) as { name: string; value: number }[];
  const stats = dashStatsData || {};
  const totalStudents = stats.totalStudents ?? 0;
  const collectedThisMonth = stats.collectedThisMonth ?? 0;
  const totalOutstanding = stats.pendingAmount ?? 0;
  const defaultersCount = stats.defaultersCount ?? 0;
  const todayPayments = stats.latestDayPayments ?? 0;
  const latestDayAmount = stats.latestDayAmount ?? 0;
  const latestPaymentDate = stats.latestPaymentDate ?? null;
  const totalLateFees = stats.totalLateFees ?? 0;
  const classSummary = (stats.classSummary ?? []).map((item) => ({ ...item, name: item.name.replace('Class ', 'C') }));
  const monthlyCollectionData = (monthlyTrendData || []).slice(-6);
  const loading = lp || lFee || lTrend || lStats;

  const monthChange = useMemo(() => {
    const prev = monthlyCollectionData[monthlyCollectionData.length - 2]?.collected ?? 0;
    const curr = monthlyCollectionData[monthlyCollectionData.length - 1]?.collected ?? 0;
    if (prev === 0) return null;
    return Math.round(((curr - prev) / prev) * 100);
  }, [monthlyCollectionData]);

  const studentsWithoutCurrentMonthBill = stats.studentsWithoutCurrentBill ?? 0;
  const currentMonthBillsGenerated = studentsWithoutCurrentMonthBill === 0 && totalStudents > 0;
  const currentMonthLabel = new Date().toLocaleDateString('en-US', { month: 'long' });

  const recentPayments = paymentHistory.slice(0, 5);

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">School Dashboard</h1>
        <p className="page-description">Overview of students, fees, and collections</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="cursor-pointer" onClick={() => navigate('/school/students')}><StatCard title="Total Students" value={totalStudents} icon={GraduationCap} trend="Live directory count" trendUp /></div>
        <StatCard title="Collected This Month" value={formatPKR(collectedThisMonth)} icon={Wallet} trend={collectedThisMonth > 0 ? 'from payment history' : 'No payments this month'} trendUp={collectedThisMonth > 0} />
        <div className="cursor-pointer" onClick={() => navigate('/school/defaulters')}><StatCard title="Outstanding" value={formatPKR(totalOutstanding)} icon={AlertTriangle} trend={`${defaultersCount} defaulters`} trendUp={false} /></div>
        <StatCard title="Defaulters" value={defaultersCount} icon={Users} />
        <StatCard title="Latest Day Payments" value={todayPayments} icon={Calendar} trend={latestPaymentDate ? `${formatPKR(latestDayAmount)} on ${latestPaymentDate}` : 'No payments yet'} trendUp={todayPayments > 0} />
        <StatCard title="Late Fees Collected" value={formatPKR(totalLateFees)} icon={TrendingUp} trend={totalLateFees > 0 ? 'From overdue payments' : 'None charged yet'} trendUp={false} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Collection */}
        <div className="dashboard-card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Monthly Collection Trend</h3>
            {monthChange !== null && (
              <span className={monthChange >= 0 ? 'metric-change-up' : 'metric-change-down'}>
                {monthChange >= 0 ? '↑' : '↓'} {Math.abs(monthChange)}%
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyCollectionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="month" fontSize={11} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
              <YAxis fontSize={11} tickFormatter={(v) => `${v / 1000}K`} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
              <Tooltip formatter={(v: number) => formatPKR(v)} contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid hsl(220, 13%, 91%)' }} />
              <Bar dataKey="collected" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} name="Collected" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Fee Plan Breakdown */}
        <div className="dashboard-card">
          <h3 className="section-title mb-4">Collection by Fee Plan</h3>
          {feeByPlan.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-20">No fee plans configured.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={feeByPlan} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                  {feeByPlan.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatPKR(v)} />
                <Legend formatter={(value) => <span className="text-xs">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Payments */}
        <div className="dashboard-card">
          <h3 className="section-title mb-4">Recent Payments</h3>
          <div className="space-y-3">
            {recentPayments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center"><Wallet className="w-4 h-4 text-success" /></div>
                  <div>
                    <p className="text-sm font-medium">{payment.studentName}</p>
                    <p className="text-[11px] text-muted-foreground">{payment.note}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-semibold text-success">{formatPKR(payment.amount)}</p>
                  <p className="text-[10px] text-muted-foreground">{payment.date}</p>
                </div>
              </div>
            ))}
            {recentPayments.length === 0 && (
              <p className="text-sm text-muted-foreground">No completed payments available yet.</p>
            )}
          </div>
        </div>

        {/* Overdue Alerts */}
        <div className="dashboard-card">
          <h3 className="section-title mb-4">Overdue Alerts</h3>
          <div className="space-y-3">
            <div className="rounded-xl bg-destructive/5 border border-destructive/10 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <div><p className="text-sm font-medium text-destructive">{defaultersCount} students currently have outstanding dues</p><p className="text-xs text-muted-foreground mt-1">Total outstanding: {formatPKR(totalOutstanding)}</p></div>
            </div>
            {!currentMonthBillsGenerated && studentsWithoutCurrentMonthBill > 0 && (
              <div className="rounded-xl bg-warning/5 border border-warning/10 p-4 flex items-start gap-3">
                <Receipt className="w-5 h-5 text-warning mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Monthly bills not generated for {currentMonthLabel}</p>
                  <p className="text-xs text-muted-foreground mt-1">Generate bills for {studentsWithoutCurrentMonthBill} student{studentsWithoutCurrentMonthBill !== 1 ? 's' : ''}</p>
                </div>
              </div>
            )}
            {monthChange !== null && (
              <div className={`rounded-xl p-4 flex items-start gap-3 ${monthChange >= 0 ? 'bg-primary/5 border border-primary/10' : 'bg-destructive/5 border border-destructive/10'}`}>
                <TrendingUp className={`w-5 h-5 mt-0.5 shrink-0 ${monthChange >= 0 ? 'text-primary' : 'text-destructive'}`} />
                <div>
                  <p className="text-sm font-medium">
                    Collection rate {monthChange >= 0 ? 'improved' : 'dropped'} by {Math.abs(monthChange)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Collections are trending {monthChange >= 0 ? 'up' : 'down'} compared to last month
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Students by Class */}
      <div className="dashboard-card">
        <h3 className="section-title mb-4">Students by Class</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={classSummary}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
            <XAxis dataKey="name" fontSize={11} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
            <YAxis fontSize={11} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
            <Tooltip contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid hsl(220, 13%, 91%)' }} />
            <Bar dataKey="count" fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SchoolDashboard;
