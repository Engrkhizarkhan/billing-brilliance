import { StatCard } from '@/components/StatCard';
import { GraduationCap, Receipt, Wallet, Award } from 'lucide-react';
import { students, invoices } from '@/data/mockData';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const feeCollectionData = [
  { month: 'Oct', collected: 720000, pending: 180000 },
  { month: 'Nov', collected: 810000, pending: 150000 },
  { month: 'Dec', collected: 690000, pending: 210000 },
  { month: 'Jan', collected: 880000, pending: 120000 },
  { month: 'Feb', collected: 850000, pending: 140000 },
  { month: 'Mar', collected: 920000, pending: 100000 },
];

const SchoolDashboard = () => (
  <div className="space-y-6 animate-fade-in">
    <div>
      <h1 className="page-header">School Dashboard</h1>
      <p className="page-description">Manage students and billing</p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard title="Total Students" value={students.length} icon={GraduationCap} />
      <StatCard title="Pending Invoices" value={invoices.filter(i => i.status === 'pending').length} icon={Receipt} />
      <StatCard title="Collected" value="₨ 4.87M" icon={Wallet} trend="10% vs last month" trendUp />
      <StatCard title="Scholarships" value="10" icon={Award} />
    </div>
    <div className="dashboard-card">
      <h3 className="font-semibold mb-4">Fee Collection Trend</h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={feeCollectionData}>
          <defs>
            <linearGradient id="colGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
          <XAxis dataKey="month" fontSize={12} />
          <YAxis fontSize={12} tickFormatter={(v) => `${v / 1000}K`} />
          <Tooltip formatter={(v: number) => `₨ ${v.toLocaleString()}`} />
          <Area type="monotone" dataKey="collected" stroke="hsl(160, 84%, 39%)" fill="url(#colGrad)" strokeWidth={2} />
          <Area type="monotone" dataKey="pending" stroke="hsl(38, 92%, 50%)" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export default SchoolDashboard;
