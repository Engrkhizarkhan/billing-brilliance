import { revenueData } from '@/data/mockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const ETAReports = () => (
  <div className="space-y-6 animate-fade-in">
    <div>
      <h1 className="page-header">Reports</h1>
      <p className="page-description">Agency analytics</p>
    </div>
    <div className="dashboard-card">
      <h3 className="font-semibold mb-4">Monthly Collections</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={revenueData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
          <XAxis dataKey="month" fontSize={12} />
          <YAxis fontSize={12} tickFormatter={(v) => `${v / 1000}K`} />
          <Tooltip formatter={(v: number) => [`₨ ${v.toLocaleString()}`, 'Collected']} />
          <Bar dataKey="revenue" fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export default ETAReports;
