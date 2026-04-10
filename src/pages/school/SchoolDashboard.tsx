import { StatCard } from '@/components/StatCard';
import { GraduationCap, Receipt, Wallet, Users, AlertTriangle, Calendar, TrendingUp, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import { useMemo } from 'react';
import { formatPKR } from '@/lib/formatters';
import { useNavigate } from 'react-router-dom';
import { usePaymentStore } from '@/store/paymentStore';
import type { Student, Invoice } from '@/types';

const CHART_COLORS = ['hsl(221, 83%, 53%)', 'hsl(160, 84%, 39%)', 'hsl(38, 92%, 50%)', 'hsl(271, 55%, 55%)', 'hsl(0, 72%, 51%)'];

const SchoolDashboard = () => {
  const navigate = useNavigate();
  const paymentVersion = usePaymentStore((state) => state.version);

  const { data: studentsData, loading: ls } = useApiQuery(() => api.fetchStudents({}), []);
  const { data: invoicesData, loading: li } = useApiQuery(() => api.fetchInvoices({}), [paymentVersion]);
  const { data: paymentHistoryData, loading: lp } = useApiQuery(() => api.fetchPaymentHistory(), [paymentVersion]);
  const { data: feeByPlanData, loading: lFee } = useApiQuery(() => api.getCollectionByFeePlan(), [paymentVersion]);
  const { data: dashStatsData } = useApiQuery(() => api.getDashboardStats(), [paymentVersion]);

  const students = (studentsData || []) as Student[];
  const invoices = (invoicesData || []) as Invoice[];
  const paymentHistory = (paymentHistoryData || []) as Array<{ id: string; studentName: string; amount: number; date: string; note: string }>;
  const feeByPlan = (feeByPlanData || []) as { name: string; value: number }[];
  const totalLateFees = (dashStatsData as { totalLateFees?: number } | null)?.totalLateFees ?? 0;
  const loading = ls || li || lp || lFee;

  const classSummary = useMemo(() => {
    const map: Record<string, number> = {};
    students.forEach((s) => { map[s.class] = (map[s.class] || 0) + 1; });
    return Object.entries(map).map(([name, count]) => ({ name: name.replace('Class ', 'C'), count })).sort((a, b) => a.name.localeCompare(b.name));
  }, [students]);

  const defaulterInfo = useMemo(() => {
    let totalOutstanding = 0;
    let defaultersCount = 0;
    students.forEach((student) => {
      const due = invoices.filter((inv) => inv.consumerNumber === student.consumerNumber && (inv.status === 'overdue' || inv.status === 'pending')).reduce((sum, inv) => sum + Number(inv.amount), 0);
      if (due > 0) { totalOutstanding += due; defaultersCount += 1; }
    });
    return { totalOutstanding, defaultersCount };
  }, [students, invoices]);

  const currentMonthKey = new Date().toISOString().slice(0, 7);

  const collectedThisMonth = useMemo(
    () => paymentHistory.filter((p) => p.date?.slice(0, 7) === currentMonthKey).reduce((sum, p) => sum + Number(p.amount || 0), 0),
    [paymentHistory, currentMonthKey]
  );

  const monthlyCollectionData = useMemo(() => {
    const map: Record<string, number> = {};
    paymentHistory.forEach((p) => {
      if (!p.date) return;
      const key = p.date.slice(0, 7);
      map[key] = (map[key] || 0) + Number(p.amount || 0);
    });
    const months: { month: string; collected: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      months.push({ month: d.toLocaleDateString('en-US', { month: 'short' }), collected: map[key] || 0 });
    }
    return months;
  }, [paymentHistory]);

  // "Latest day" = the most recent distinct date in payment history (date may be ISO timestamp)
  const latestPaymentDate = paymentHistory[0]?.date?.slice(0, 10) || null;
  const latestDayPayments = latestPaymentDate
    ? paymentHistory.filter((payment) => payment.date?.slice(0, 10) === latestPaymentDate)
    : [];

  const { totalOutstanding, defaultersCount } = defaulterInfo;
  const todayPayments = latestDayPayments.length;
  const latestDayAmount = latestDayPayments.reduce((sum, payment) => sum + payment.amount, 0);

  const monthChange = useMemo(() => {
    const prev = monthlyCollectionData[monthlyCollectionData.length - 2]?.collected ?? 0;
    const curr = monthlyCollectionData[monthlyCollectionData.length - 1]?.collected ?? 0;
    if (prev === 0) return null;
    return Math.round(((curr - prev) / prev) * 100);
  }, [monthlyCollectionData]);

  const studentsWithoutCurrentMonthBill = useMemo(() => {
    const studentsWithBill = new Set(
      invoices
        .filter((inv) => inv.month === currentMonthKey)
        .flatMap((inv) => [inv.studentId, inv.consumerNumber].filter(Boolean))
    );
    return students.filter((s) => !studentsWithBill.has(s.id) && !studentsWithBill.has(s.consumerNumber)).length;
  }, [students, invoices, currentMonthKey]);

  const currentMonthBillsGenerated = studentsWithoutCurrentMonthBill === 0 && students.length > 0;
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
        <div className="cursor-pointer" onClick={() => navigate('/school/students')}><StatCard title="Total Students" value={students.length} icon={GraduationCap} trend="5 new this month" trendUp /></div>
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
