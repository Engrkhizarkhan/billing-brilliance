import { revenueData, paymentSuccessData } from '@/data/mockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const pieData = [
  { name: 'Schools', value: 65 },
  { name: 'ETEA', value: 25 },
  { name: 'Agencies', value: 10 },
];
const COLORS = ['hsl(221, 83%, 53%)', 'hsl(160, 84%, 39%)', 'hsl(38, 92%, 50%)'];

const Reports = () => (
  <div className="space-y-6 animate-fade-in">
    <div>
      <h1 className="page-header">Reports</h1>
      <p className="page-description">Analytics and reports</p>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="dashboard-card">
        <h3 className="font-semibold mb-4">Revenue by Month</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
            <XAxis dataKey="month" fontSize={12} />
            <YAxis fontSize={12} tickFormatter={(v) => `${v / 1000}K`} />
            <Tooltip formatter={(v: number) => [`₨ ${v.toLocaleString()}`, 'Revenue']} />
            <Bar dataKey="revenue" fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="dashboard-card">
        <h3 className="font-semibold mb-4">Revenue by Biller Type</h3>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
              {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
);

export default Reports;
