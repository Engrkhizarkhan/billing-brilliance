import { StatCard } from '@/components/StatCard';
import { GraduationCap, Receipt, Wallet, Award, Users, AlertTriangle, Calendar, TrendingUp } from 'lucide-react';
import { students, invoices, feeCollectionByHead, monthlyCollectionTarget } from '@/data/mockData';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import { useMemo } from 'react';
import { formatPKR } from '@/lib/formatters';
import { useNavigate } from 'react-router-dom';

const CHART_COLORS = ['hsl(221, 83%, 53%)', 'hsl(160, 84%, 39%)', 'hsl(38, 92%, 50%)', 'hsl(271, 55%, 55%)', 'hsl(0, 72%, 51%)'];

const SchoolDashboard = () => {
  const navigate = useNavigate();

  const classSummary = useMemo(() => {
    const map: Record<string, number> = {};
    students.forEach((s) => { map[s.class] = (map[s.class] || 0) + 1; });
    return Object.entries(map).map(([name, count]) => ({ name: name.replace('Class ', 'C'), count })).sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const totalOutstanding = students.reduce((sum, s) => sum + s.balance, 0);
  const defaultersCount = students.filter(s => s.balance > 0).length;
  const todayPayments = 12;

  const recentPayments = [
    { name: 'Ahmed Khan', amount: 5000, type: 'Tuition Fee', time: '2 min ago' },
    { name: 'Sara Ali', amount: 15000, type: 'Monthly Fee', time: '15 min ago' },
    { name: 'Hassan Raza', amount: 6700, type: 'Tuition + Transport', time: '1 hour ago' },
    { name: 'Fatima Noor', amount: 3000, type: 'Exam Fee', time: '2 hours ago' },
    { name: 'Bilal Ahmed', amount: 5000, type: 'Tuition Fee', time: '3 hours ago' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">School Dashboard</h1>
        <p className="page-description">Overview of students, fees, and collections</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="cursor-pointer" onClick={() => navigate('/school/students')}><StatCard title="Total Students" value={students.length} icon={GraduationCap} trend="5 new this month" trendUp /></div>
        <StatCard title="Collected This Month" value={formatPKR(920000)} icon={Wallet} trend="10% vs last month" trendUp />
        <div className="cursor-pointer" onClick={() => navigate('/school/defaulters')}><StatCard title="Outstanding" value={formatPKR(totalOutstanding)} icon={AlertTriangle} trend={`${defaultersCount} defaulters`} trendUp={false} /></div>
        <StatCard title="Defaulters" value={defaultersCount} icon={Users} />
        <StatCard title="Today's Payments" value={todayPayments} icon={Calendar} trend="₨ 34,700" trendUp />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Collection vs Target */}
        <div className="dashboard-card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Monthly Collection vs Target</h3>
            <span className="metric-change-up">↑ 10%</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyCollectionTarget}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="month" fontSize={11} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
              <YAxis fontSize={11} tickFormatter={(v) => `${v / 1000}K`} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
              <Tooltip formatter={(v: number) => formatPKR(v)} contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid hsl(220, 13%, 91%)' }} />
              <Bar dataKey="collected" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} name="Collected" />
              <Bar dataKey="target" fill="hsl(220, 13%, 91%)" radius={[4, 4, 0, 0]} name="Target" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Fee Head Breakdown */}
        <div className="dashboard-card">
          <h3 className="section-title mb-4">Collection by Fee Head</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={feeCollectionByHead} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                {feeCollectionByHead.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatPKR(v)} />
              <Legend formatter={(value) => <span className="text-xs">{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Payments */}
        <div className="dashboard-card">
          <h3 className="section-title mb-4">Recent Payments</h3>
          <div className="space-y-3">
            {recentPayments.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center"><Wallet className="w-4 h-4 text-success" /></div>
                  <div><p className="text-sm font-medium">{p.name}</p><p className="text-[11px] text-muted-foreground">{p.type}</p></div>
                </div>
                <div className="text-right"><p className="text-sm font-mono font-semibold text-success">{formatPKR(p.amount)}</p><p className="text-[10px] text-muted-foreground">{p.time}</p></div>
              </div>
            ))}
          </div>
        </div>

        {/* Overdue Alerts */}
        <div className="dashboard-card">
          <h3 className="section-title mb-4">Overdue Alerts</h3>
          <div className="space-y-3">
            <div className="rounded-xl bg-destructive/5 border border-destructive/10 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <div><p className="text-sm font-medium text-destructive">23 students have dues older than 30 days</p><p className="text-xs text-muted-foreground mt-1">Total outstanding: {formatPKR(totalOutstanding)}</p></div>
            </div>
            <div className="rounded-xl bg-warning/5 border border-warning/10 p-4 flex items-start gap-3">
              <Receipt className="w-5 h-5 text-warning mt-0.5 shrink-0" />
              <div><p className="text-sm font-medium">Monthly bills not generated for April</p><p className="text-xs text-muted-foreground mt-1">Generate bills for 342 students</p></div>
            </div>
            <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div><p className="text-sm font-medium">Collection rate improved by 10%</p><p className="text-xs text-muted-foreground mt-1">March collections exceeded target</p></div>
            </div>
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
