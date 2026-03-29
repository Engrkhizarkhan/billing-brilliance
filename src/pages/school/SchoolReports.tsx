import { useMemo } from 'react';
import { StatCard } from '@/components/StatCard';
import { revenueData, monthlyCollectionTarget, feeCollectionByHead, invoices, students } from '@/data/mockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Wallet, Target, AlertTriangle, BarChart3 } from 'lucide-react';
import { formatPKR } from '@/lib/formatters';

const CHART_COLORS = ['hsl(221, 83%, 53%)', 'hsl(160, 84%, 39%)', 'hsl(38, 92%, 50%)', 'hsl(271, 55%, 55%)', 'hsl(0, 72%, 51%)'];

const invoiceStatusData = [
  { status: 'Paid', count: invoices.filter((invoice) => invoice.status === 'paid').length },
  { status: 'Pending', count: invoices.filter((invoice) => invoice.status === 'pending').length },
  { status: 'Overdue', count: invoices.filter((invoice) => invoice.status === 'overdue').length },
];

const SchoolReports = () => {
  const totalCollected = monthlyCollectionTarget.reduce((sum, month) => sum + month.collected, 0);
  const totalTarget = monthlyCollectionTarget.reduce((sum, month) => sum + month.target, 0);
  const targetGap = totalTarget - totalCollected;
  const overdueCount = invoices.filter((invoice) => invoice.status === 'overdue').length;

  const defaultersByClass = useMemo(() => {
    const classMap: Record<string, number> = {};
    students.filter((student) => student.balance > 0).forEach((student) => {
      classMap[student.class] = (classMap[student.class] || 0) + 1;
    });

    return Object.entries(classMap)
      .map(([className, count]) => ({ className: className.replace('Class ', 'C'), count }))
      .sort((a, b) => a.className.localeCompare(b.className));
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Reports</h1>
        <p className="page-description">School analytics and collection performance reports</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Collected" value={formatPKR(totalCollected)} icon={Wallet} trend="Across selected report period" trendUp />
        <StatCard title="Collection Target" value={formatPKR(totalTarget)} icon={Target} />
        <StatCard title="Target Gap" value={formatPKR(Math.max(targetGap, 0))} icon={BarChart3} trend={targetGap > 0 ? 'Needs improvement' : 'Target exceeded'} trendUp={targetGap <= 0} />
        <StatCard title="Overdue Invoices" value={overdueCount} icon={AlertTriangle} trend="Requires follow-up" trendUp={false} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="dashboard-card">
          <h3 className="font-semibold mb-4">Monthly Collection vs Target</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyCollectionTarget}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v) => `${v / 1000}K`} />
              <Tooltip formatter={(v: number) => [formatPKR(v), 'Amount']} />
              <Legend />
              <Bar dataKey="collected" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} name="Collected" />
              <Bar dataKey="target" fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} name="Target" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="dashboard-card">
          <h3 className="font-semibold mb-4">Collection by Fee Head</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={feeCollectionByHead}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={105}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {feeCollectionByHead.map((_, index) => (
                  <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatPKR(v)} />
            </PieChart>
          </ResponsiveContainer>
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
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
            <XAxis dataKey="month" fontSize={12} />
            <YAxis fontSize={12} tickFormatter={(v) => `${v / 1000}K`} />
            <Tooltip formatter={(v: number) => [formatPKR(v), 'Revenue']} />
            <Line type="monotone" dataKey="revenue" stroke="hsl(160, 84%, 39%)" strokeWidth={2.5} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SchoolReports;
