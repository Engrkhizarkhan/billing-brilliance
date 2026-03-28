import { StatCard } from '@/components/StatCard';
import { GraduationCap, Receipt, Wallet, Award, TrendingUp, Users } from 'lucide-react';
import { students, invoices } from '@/data/mockData';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useMemo } from 'react';

const feeCollectionData = [
  { month: 'Oct', collected: 720000, pending: 180000 },
  { month: 'Nov', collected: 810000, pending: 150000 },
  { month: 'Dec', collected: 690000, pending: 210000 },
  { month: 'Jan', collected: 880000, pending: 120000 },
  { month: 'Feb', collected: 850000, pending: 140000 },
  { month: 'Mar', collected: 920000, pending: 100000 },
];

const SchoolDashboard = () => {
  const classSummary = useMemo(() => {
    const map: Record<string, number> = {};
    students.forEach((s) => { map[s.class] = (map[s.class] || 0) + 1; });
    return Object.entries(map).map(([name, count]) => ({ name: name.replace('Class ', 'C'), count })).sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">School Dashboard</h1>
        <p className="page-description">Overview of students, fees, and collections</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Students" value={students.length} icon={GraduationCap} trend="5 new this month" trendUp />
        <StatCard title="Pending Invoices" value={invoices.filter(i => i.status === 'pending').length} icon={Receipt} />
        <StatCard title="Collected" value="₨ 4.87M" icon={Wallet} trend="10% vs last month" trendUp />
        <StatCard title="Scholarships" value="10" icon={Award} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="dashboard-card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Fee Collection Trend</h3>
            <span className="metric-change-up">↑ 10%</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={feeCollectionData}>
              <defs>
                <linearGradient id="colGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="month" fontSize={11} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
              <YAxis fontSize={11} tickFormatter={(v) => `${v / 1000}K`} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
              <Tooltip formatter={(v: number) => `₨ ${v.toLocaleString()}`} contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid hsl(220, 13%, 91%)' }} />
              <Area type="monotone" dataKey="collected" stroke="hsl(160, 84%, 39%)" fill="url(#colGrad)" strokeWidth={2.5} />
              <Area type="monotone" dataKey="pending" stroke="hsl(38, 92%, 50%)" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Students by Class</h3>
            <Users className="w-4 h-4 text-muted-foreground" />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={classSummary} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis type="number" fontSize={11} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
              <YAxis dataKey="name" type="category" fontSize={11} width={30} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
              <Tooltip contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid hsl(220, 13%, 91%)' }} />
              <Bar dataKey="count" fill="hsl(221, 83%, 53%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default SchoolDashboard;
